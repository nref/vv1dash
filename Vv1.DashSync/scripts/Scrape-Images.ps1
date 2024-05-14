
# Scrapes VV1 images from the VV1 cam WordPress site
# Iterates over all pages 1 to 14 and downloads all images linked from <img data-large-file="..."

# Define the base URL and target directory for downloads. The code will append the page number.
$baseUrl = "https://iknox.org/vv1/"
$downloadPath = "."

# Create the download directory if it doesn't exist
if (-not (Test-Path $downloadPath)) {
    New-Item -Path $downloadPath -ItemType Directory
}

# Function to download images from a single page
function Download-ImagesFromPage($url, $downloadPath) {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing
    #
    # Use regex to match <img> tags with 'data-large-file' attributes
    $imgTags = Select-String -InputObject $response.Content -Pattern '<img[^>]+data-large-file="([^"]+)\?' -AllMatches | ForEach-Object { $_.Matches }

    foreach ($img in $imgTags) {
        $imageUrl = $img.Groups[1].Value -replace '&amp;', '&'  # Decode HTML entities

        # Extract year and month from the URL path
        if ($imageUrl -match 'uploads/(\d{4})/(\d{2})/') {
            $year = $Matches[1]
            #$month = $Matches[2] # Can be wrong e.g. for 2023/08/7.31.jpg
        }

        # Extract day from the filename, handling various formats
        $fileName = [System.IO.Path]::GetFileName($imageUrl)
        $day = '01' # Default if day cannot be extracted

        $pattern = "unknown"

        # Patterns to extract day and month from file names
        
        # MM.DD.YY
        # e.g. https://i0.wp.com/iknox.org/wp-content/uploads/2024/01/01.05.24.jpg -> 2024-01-05_01.05.24.jpg (MM.DD.YY)
        if ($fileName -match '(\d{2})\.(\d{2})\.(\d{2})') { 
            $month = $Matches[1]
            $day = $Matches[2]
            $pattern = "MM.DD.YY"

        # MM.DD
        # e.g. https://i0.wp.com/iknox.org/wp-content/uploads/2023/08/8.16.jpg -> 2023-8-16_8.16.jpg (MM.DD)
        } elseif ($fileName -match '(\d{1,2})\.(\d{1,2})') { 
            $month = $Matches[1]
            $day = $Matches[2]
            $pattern = "MM.DD"
        
        # MMDDYYYY
        # e.g. https://i0.wp.com/iknox.org/wp-content/uploads/2023/08/868032063269512-90-4-08132023144426-W1000137.jpg 
        } elseif ($fileName -match '-(\d{2})(\d{2})(\d{4})') { 
            $month = $Matches[1]
            $day = $Matches[2]
            $pattern = "MMDDYYYY"
        }

        # Convert strings to integers and create a DateTime object
        $date = New-Object DateTime ([int]$year, [int]$month, [int]$day)

        # Subtract a year if the date is after today. Some uploads are from the previous year /uploads/2024/01/12.31.jpg is really for 12.31.2023 but was uploaded in Jan 2024.
        if ($date -gt (Get-Date)) {
            # Subtract one year from the date
            $date = $date.AddYears(-1)
        }

        # Output the date in YYYY-MM-DD format
        $formattedDate = $date.ToString("yyyy-MM-dd")
        $extension = [System.IO.Path]::GetExtension($imageUrl)
        $newFileName = "{0}{1}" -f $formattedDate, $extension

        # Combine the download path with the new file name to create the full local path
        $localPath = Join-Path $downloadPath $newFileName
        
        # Check if the file already exists
        if (-Not (Test-Path $localPath)) {
            Write-Host "    $imageUrl -> $newFileName ($pattern)"
            Invoke-WebRequest -Uri $imageUrl -OutFile $localPath
        } else {
        }
    }
}

$funcDef = ${function:Download-ImagesFromPage}.ToString()

# Iterate over each page and download images in series
#1..14 | ForEach-Object {
    #$pageUrl = "$baseUrl$_"

# Iterate over each page and download images in parallel
1..14 | ForEach-Object -Parallel {
    $pageUrl = "$using:baseUrl$_"
    $downloadPath = "$using:downloadPath"
    ${function:Download-ImagesFromPage} = $using:funcDef

    Write-Host $pageUrl
    Download-ImagesFromPage $pageUrl $downloadPath
# }
} -ThrottleLimit 10  # Adjust the throttle limit as needed for your environment
