param(
  [string]$FUNCTION_NAME = "img-resizer-sign",
  [string]$REGION = "us-west-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Building Docker image..."
docker build -t sign-zip -f .\Dockerfile . 
if ($LASTEXITCODE -ne 0) { throw "Docker build failed." }

Write-Host "Extracting zip from container..."
$cid = (docker create sign-zip)
try {
  docker cp "$($cid):/out/sign.zip" ".\sign.zip"
} finally {
  docker rm $cid | Out-Null
}
if (-not (Test-Path ".\sign.zip")) { throw "sign.zip not found after docker cp." }

Write-Host "Updating Lambda code..."
aws lambda update-function-code `
  --function-name $FUNCTION_NAME `
  --zip-file fileb://sign.zip `
  --region $REGION | Out-Null

Write-Host "✅ Deployed $FUNCTION_NAME"
