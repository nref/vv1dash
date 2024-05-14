using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json;

namespace Vv1.DashSync;

public class PhotoSyncService
{
    private readonly HttpClient client = new();
    private const string AuthFilePath = "auth_result.json";
    private static readonly TimeSpan DefaultStartTimeEastern = new(8, 0, 0); // 8:00 AM
    private static readonly TimeSpan DefaultEndTimeEastern = new(12, 0, 0);

    public async Task SyncPhotos(string targetDirectory)
    {
        try
        {
            AuthenticationResult? auth = LoadAuthenticationResult();
            if (auth == null || IsTokenExpired(auth))
            {
                auth = await Login();
                if (auth != null)
                {
                    SaveAuthenticationResult(auth);
                }
            }

            if (auth is null) { return; }
            if (auth.AccessToken is null) { return; }

            PhotosResponse? photos = await GetPhotosList(auth.AccessToken);
            if (photos?.Response?.Photos is null) { return; }

            // Only download photos taken at about the same time of day
            List<Photo> filteredPhotos = FilterPhotosByTime(photos.Response.Photos, DefaultStartTimeEastern, DefaultEndTimeEastern);
            await GetPhotos(filteredPhotos, targetDirectory);
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
        }

    }
    private AuthenticationResult? LoadAuthenticationResult()
    {
        if (!File.Exists(AuthFilePath)) { return null; }

        var json = File.ReadAllText(AuthFilePath);
        return JsonSerializer.Deserialize<AuthenticationResult>(json);
    }

    private void SaveAuthenticationResult(AuthenticationResult authResult)
    {
        var json = JsonSerializer.Serialize(authResult);
        File.WriteAllText(AuthFilePath, json);
    }

    private bool IsTokenExpired(AuthenticationResult authResult)
    {
        if (authResult.AccessToken == null) return true;

        var handler = new JwtSecurityTokenHandler();
        var jsonToken = handler.ReadToken(authResult.AccessToken) as JwtSecurityToken;

        if (jsonToken == null) return true;

        var exp = jsonToken.Payload.Expiration;
        if (exp == null) return true;

        var expirationTime = DateTimeOffset.FromUnixTimeSeconds((long)exp);
        return DateTimeOffset.UtcNow >= expirationTime;
    }

    private string GetEnvVar(string key) => Environment.GetEnvironmentVariable(key) ?? throw new ArgumentException($"Environment variable {key} not found");

    public async Task<AuthenticationResult?> Login()
    {
        var authParameters = new
        {
            AuthFlow = "USER_PASSWORD_AUTH",
            ClientId = GetEnvVar("VV1DASHSYNC_CLIENTID"), 
            AuthParameters = new
            {
                USERNAME = GetEnvVar("VV1DASHSYNC_USER"),
                PASSWORD = GetEnvVar("VV1DASHSYNC_PASS"),
            },
            ClientMetadata = new { }
        };

        var content = new StringContent(JsonSerializer.Serialize(authParameters), Encoding.UTF8, "application/x-amz-json-1.1");

        var request = new HttpRequestMessage(HttpMethod.Post, "https://cognito-idp.us-east-1.amazonaws.com/")
        {
            Content = content
        };

        // Add headers
        request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0");
        request.Headers.Add("Accept", "*/*");
        request.Headers.Add("Accept-Language", "en-US,en;q=0.5");
        request.Headers.Add("Accept-Encoding", "gzip, deflate, br");
        request.Headers.Add("Referer", "https://account.revealcellcam.com/");
        request.Headers.Add("X-Amz-Target", "AWSCognitoIdentityProviderService.InitiateAuth");
        request.Headers.Add("X-Amz-User-Agent", "aws-amplify/5.0.4 auth framework/1");
        request.Headers.Add("Cache-Control", "no-store, no-cache");
        request.Headers.Add("Origin", "https://account.revealcellcam.com");
        request.Headers.Add("DNT", "1");
        request.Headers.Add("Connection", "keep-alive");
        request.Headers.Add("Sec-Fetch-Dest", "empty");
        request.Headers.Add("Sec-Fetch-Mode", "cors");
        request.Headers.Add("Sec-Fetch-Site", "cross-site");
        request.Headers.Add("Pragma", "no-cache");
        request.Headers.Add("TE", "trailers");

        HttpResponseMessage response = await client.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine($"Login failed: {response.StatusCode} {response.Content}");
            return null;
        }

        string responseBody = await response.Content.ReadAsStringAsync();

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        var authResponse = JsonSerializer.Deserialize<AuthResponse>(responseBody, options);
        return authResponse?.AuthenticationResult;
    }

    private async Task<PhotosResponse?> GetPhotosList(string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "https://api.reveal.ishareit.net/v1/photos?size=100&page=0");
        request.Headers.Add("authorization", $"Bearer {accessToken}");

        HttpResponseMessage response = await client.SendAsync(request);

        if (response.IsSuccessStatusCode)
        {
            string responseBody = await response.Content.ReadAsStringAsync();

            // Deserialize JSON response
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };
            var photosResponse = JsonSerializer.Deserialize<PhotosResponse>(responseBody, options);
            return photosResponse;
        }
        else
        {
            Console.WriteLine($"Get photos failed: {response.StatusCode} {response.Content}");
            return null;
        }
    }

    private static List<Photo> FilterPhotosByTime(List<Photo> photos, TimeSpan startTimeEastern, TimeSpan endTimeEastern)
    {
        var startTimeLocal = new DateTime(DateTime.Now.Year, DateTime.Now.Month, DateTime.Now.Day, startTimeEastern.Hours, startTimeEastern.Minutes, startTimeEastern.Seconds, DateTimeKind.Local);
        var endTimeLocal = new DateTime(DateTime.Now.Year, DateTime.Now.Month, DateTime.Now.Day, endTimeEastern.Hours, endTimeEastern.Minutes, endTimeEastern.Seconds, DateTimeKind.Local);

        var filteredPhotos = new List<Photo>();
        foreach (var photo in photos)
        {
            if (DateTime.TryParse(photo.PhotoDateUtc, null, DateTimeStyles.AssumeUniversal, out var photoDateTime))
            {
                if (photoDateTime.TimeOfDay >= startTimeLocal.TimeOfDay && photoDateTime.TimeOfDay <= endTimeLocal.TimeOfDay)
                {
                    filteredPhotos.Add(photo);
                }
            }
        }

        return filteredPhotos;
    }

    private async Task GetPhotos(List<Photo>? photos, string targetDirectory)
    {
        if (photos is null) { return; }

        await Parallel.ForEachAsync(photos, async (photo, _) =>
        {
            if (photo.PhotoUrl is null) { return; }
            string extension = Path.GetExtension(photo.PhotoId) ?? ".jpg";

            string fileName = DateTime.TryParse(photo.PhotoDateUtc, out DateTime photoDateUtc)
                ? $"{photoDateUtc:yyyy-MM-dd}{extension}"
                : $"{photo.PhotoId}";

            await DownloadPhoto(photo.PhotoUrl, fileName, targetDirectory);
        });
    }

    private async Task DownloadPhoto(string photoUrl, string filename, string targetDirectory)
    {
        HttpResponseMessage response = await client.GetAsync(photoUrl);

        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine($"Downloading {photoUrl} failed: {response.StatusCode} {response.Content}");
            return;
        }

        byte[] photoBytes = await response.Content.ReadAsByteArrayAsync();
        string filePath = Path.Combine(targetDirectory, filename);

        if (File.Exists(filePath)) { return; }

        Directory.CreateDirectory(targetDirectory);

        await File.WriteAllBytesAsync(filePath, photoBytes);
        Console.WriteLine($"Downloaded {filePath}");
    }
}