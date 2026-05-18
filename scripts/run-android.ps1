param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExpoArgs = @()
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

$env:GRADLE_USER_HOME = Join-Path $projectRoot ".gradle-local"
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null

Write-Host "Using project Gradle cache: $env:GRADLE_USER_HOME"

& npx expo run:android @ExpoArgs
exit $LASTEXITCODE
