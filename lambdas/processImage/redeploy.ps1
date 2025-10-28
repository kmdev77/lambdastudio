param(
  [string]$TfDir = "C:\resizer-tf\terraform"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "==> Zipping in Docker..."
mkdir dist -Force | Out-Null
docker run --rm -v "${PWD}:/work" -w /work public.ecr.aws/amazonlinux/amazonlinux:2023 `
  bash -lc "dnf -y install zip >/dev/null && rm -f dist/processImage.zip && \
            zip -r9 dist/processImage.zip index.mjs package.json package-lock.json node_modules >/dev/null && \
            ls -lh dist/processImage.zip"

Write-Host "==> Terraform apply (Lambda only)..."
Push-Location $TfDir
terraform apply --target=aws_lambda_function.process -auto-approve
Pop-Location

Write-Host "==> Done."
