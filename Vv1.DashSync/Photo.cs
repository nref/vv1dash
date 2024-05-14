namespace Vv1.DashSync;

public class Photo
{
    public long LastUpdatedTimestamp { get; set; }
    public Metadata? Metadata { get; set; }
    public long CreatedTimestamp { get; set; }
    public WeatherRecord? WeatherRecord { get; set; }
    public string? PhotoId { get; set; }
    public string? CameraLocation { get; set; }
    public string? AccountId { get; set; }
    public bool HdPhoto { get; set; }
    public string? Filename { get; set; }
    public string? CameraId { get; set; }
    public string? WeatherRecordId { get; set; }
    public string? PhotoType { get; set; }
    public string? PhotoDateUtc { get; set; }
    public string? PhotoTimestamp { get; set; }
    public int MinutesSinceMidnight { get; set; }
    public int NumericalPhotoDate { get; set; }
    public string? CameraName { get; set; }
    public string? PhotoUrl { get; set; }
    public bool HasHeadshot { get; set; }
}
