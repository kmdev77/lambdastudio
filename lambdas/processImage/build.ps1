$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot
if (Test-Path dist) { Remove-Item -Recurse -Force dist }
New-Item -ItemType Directory -Path dist | Out-Null
npm ci --omit=dev --platform=linux --arch=x64
Compress-Archive -Path index.mjs,node_modules,package.json,.npmrc -DestinationPath dist/processImage.zip -Force
Pop-Location