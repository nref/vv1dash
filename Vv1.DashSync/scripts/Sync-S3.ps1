$distributionId = $env:SLATER_DEV_CLOUDFRONT_DISTRIBUTIONID
$bucket = $env:SLATER_DEV_S3_BUCKET

pushd $PSScriptRoot

if (-not $?) {
    exit 1
}

write-host "Syncing with S3..."
aws s3 sync ../../dash/ s3://$bucket/vv1 --acl public-read

write-host "Invalidating Cloudfront caches..."
$createInvalidationResult = aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" | ConvertFrom-Json
$invalidationId = $createInvalidationResult.Invalidation.Id
write-host "Invalidation created with ID: $invalidationId"

# Monitor the invalidation status
$invalidationStatus = $createInvalidationResult.Invalidation.Status
while ($invalidationStatus -ne "Completed") {
    $getInvalidationResult = aws cloudfront get-invalidation --distribution-id $distributionId --id $invalidationId | ConvertFrom-Json
    $invalidationStatus = $getInvalidationResult.Invalidation.Status
    write-host "Invalidation status: $invalidationStatus"
    Start-Sleep -Seconds 2
}

write-host "Invalidation completed"
write-host "Deployment completed"
popd
