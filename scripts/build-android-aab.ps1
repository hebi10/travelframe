param(
  [int]$VersionCode = 0,
  [string]$KeystorePath = ""
)

$ErrorActionPreference = "Stop"

function Stop-WithMessage {
  param([string]$Message)
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  exit 1
}

function Require-Command {
  param([string]$CommandName)
  $found = Get-Command $CommandName -ErrorAction SilentlyContinue
  if (-not $found) {
    Stop-WithMessage "$CommandName command was not found. Install it first and try again."
  }
}

function Invoke-External {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @()
  )
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "$FilePath failed with exit code $LASTEXITCODE."
  }
}

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Value
  )
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Value, $encoding)
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

Require-Command "node"
Require-Command "npx"
Require-Command "java"

if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
  $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $defaultSdk) {
    $env:ANDROID_HOME = $defaultSdk
    $env:ANDROID_SDK_ROOT = $defaultSdk
  } else {
    Stop-WithMessage "ANDROID_HOME is not set. Install Android Studio SDK or set ANDROID_HOME first."
  }
}

if (-not $KeystorePath) {
  if ($env:ANDROID_KEYSTORE_PATH) {
    $KeystorePath = $env:ANDROID_KEYSTORE_PATH
  } else {
    $KeystorePath = Join-Path $projectRoot "credentials\android\upload-keystore.jks"
  }
}

if (-not (Test-Path -LiteralPath $KeystorePath)) {
  Stop-WithMessage "Keystore file was not found: $KeystorePath`nDownload the EAS Android keystore and put it at credentials\android\upload-keystore.jks, or set ANDROID_KEYSTORE_PATH."
}

$resolvedKeystore = (Resolve-Path -LiteralPath $KeystorePath).Path
$env:ANDROID_KEYSTORE_PATH = $resolvedKeystore

$missingEnv = @()
if (-not $env:ANDROID_KEYSTORE_PASSWORD) { $missingEnv += "ANDROID_KEYSTORE_PASSWORD" }
if (-not $env:ANDROID_KEY_ALIAS) { $missingEnv += "ANDROID_KEY_ALIAS" }
if (-not $env:ANDROID_KEY_PASSWORD) { $missingEnv += "ANDROID_KEY_PASSWORD" }
if ($missingEnv.Count -gt 0) {
  Stop-WithMessage "Missing signing environment variables: $($missingEnv -join ', ')"
}

if ($VersionCode -le 0) {
  $VersionCode = [int](Get-Date -Format "yyMMddHH")
}

Write-Host "Preparing Android project..." -ForegroundColor Cyan
Invoke-External "npx" @("expo", "prebuild", "--platform", "android", "--no-install")

$buildGradlePath = Join-Path $projectRoot "android\app\build.gradle"
if (-not (Test-Path $buildGradlePath)) {
  Stop-WithMessage "android\app\build.gradle was not generated."
}

$buildGradle = Get-Content -LiteralPath $buildGradlePath -Raw

if ($buildGradle -notmatch "TRAVELFRAME_UPLOAD_STORE_FILE") {
  $releaseSigning = @"
signingConfigs {
        release {
            // TRAVELFRAME_UPLOAD_STORE_FILE
            def uploadStoreFile = System.getenv("ANDROID_KEYSTORE_PATH")
            def uploadStorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            def uploadKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
            def uploadKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            if (uploadStoreFile == null || uploadStorePassword == null || uploadKeyAlias == null || uploadKeyPassword == null) {
                throw new GradleException("Android release signing environment variables are missing.")
            }
            storeFile file(uploadStoreFile)
            storePassword uploadStorePassword
            keyAlias uploadKeyAlias
            keyPassword uploadKeyPassword
        }
"@
  $buildGradle = $buildGradle -replace "signingConfigs\s*\{", $releaseSigning
}

$buildGradle = [regex]::Replace($buildGradle, "versionCode\s+\d+", "versionCode $VersionCode", 1)
$buildGradle = [regex]::Replace(
  $buildGradle,
  "(release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug",
  '${1}signingConfigs.release',
  1
)

Write-Utf8NoBom -Path $buildGradlePath -Value $buildGradle

Write-Host "Building AAB with versionCode $VersionCode..." -ForegroundColor Cyan
Push-Location (Join-Path $projectRoot "android")
try {
  Invoke-External ".\gradlew.bat" @("bundleRelease")
} finally {
  Pop-Location
}

$aabPath = Join-Path $projectRoot "android\app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path $aabPath)) {
  Stop-WithMessage "AAB build finished, but the output file was not found."
}

Write-Host ""
Write-Host "AAB created:" -ForegroundColor Green
Write-Host $aabPath
