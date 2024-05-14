
# Generate a list of all image files in the given directory,
# or if no directory is given, the one this script is in.

# Check if an output directory argument is provided
if ($args.Count -gt 0) {
    $outputDirectory = $args[0]
} else {
    $outputDirectory = $PSScriptRoot
}

# Get all .png, .jpg, .jpeg, and .webp files in the directory
$files = Get-ChildItem -Path $outputDirectory -Include *.png, *.jpg, *.jpeg, *.webp -Recurse

# Extract the names of the files
$fileNames = $files.Name

# Convert the list of filenames to JSON format
$json = $fileNames | ConvertTo-Json

# Specify the path for the output JSON file
$outputFilePath = Join-Path -Path $outputDirectory -ChildPath "index.json"

# Write the JSON data to the file
$json | Out-File -FilePath $outputFilePath
