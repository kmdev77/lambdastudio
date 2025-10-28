param(
  [string]$FUNCTION_NAME = "img-palette-process",
  [string]$REGION = "us-west-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Building palette docker image..."
docker build -t palette-zip -f .\Dockerfile .
if ($LASTEXITCODE -ne 0) { throw "Docker build failed." }

Write-Host "Extracting palette.zip..."
$cid = (docker create palette-zip)
try {
  docker cp "$($cid):/out/palette.zip" ".\palette.zip"
} finally {
  docker rm $cid | Out-Null
}
if (-not (Test-Path ".\palette.zip")) { throw "palette.zip not found after docker cp." }

Write-Host "Updating Lambda code..."
aws lambda update-function-code `
  --function-name $FUNCTION_NAME `
  --zip-file fileb://palette.zip `
  --region $REGION | Out-Null

Write-Host "✅ Deployed $FUNCTION_NAME"
