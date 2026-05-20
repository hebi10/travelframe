param(
  [int]$VersionCode = 0,
  [string]$KeystorePath = "",
  [string]$SigningEnvPath = ""
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

function Remove-DuplicateLauncherPngResources {
  param([string]$ProjectRoot)

  $resRoot = Join-Path $ProjectRoot "android\app\src\main\res"
  if (-not (Test-Path -LiteralPath $resRoot)) {
    return
  }

  $launcherPngs = Get-ChildItem -Path $resRoot -Recurse -File |
    Where-Object {
      $_.Name -match "^ic_launcher.*\.png$" -and
      $_.DirectoryName -match "\\mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)$"
    }

  foreach ($png in $launcherPngs) {
    $webpPath = [System.IO.Path]::ChangeExtension($png.FullName, ".webp")
    if (Test-Path -LiteralPath $webpPath) {
      Remove-Item -LiteralPath $png.FullName
    }
  }
}

function Find-MatchingBrace {
  param(
    [string]$Text,
    [int]$OpenBraceIndex
  )

  $depth = 0
  for ($i = $OpenBraceIndex; $i -lt $Text.Length; $i++) {
    if ($Text[$i] -eq "{") {
      $depth += 1
    } elseif ($Text[$i] -eq "}") {
      $depth -= 1
      if ($depth -eq 0) {
        return $i
      }
    }
  }

  return -1
}

function Remove-ReleaseSigningConfigBlock {
  param([string]$BuildGradle)

  while ($true) {
    $signingIndex = $BuildGradle.IndexOf("signingConfigs")
    if ($signingIndex -lt 0) {
      return $BuildGradle
    }

    $signingOpen = $BuildGradle.IndexOf("{", $signingIndex)
    if ($signingOpen -lt 0) {
      return $BuildGradle
    }

    $signingClose = Find-MatchingBrace -Text $BuildGradle -OpenBraceIndex $signingOpen
    if ($signingClose -lt 0) {
      return $BuildGradle
    }

    $cursor = $signingOpen + 1
    $removed = $false

    while ($cursor -lt $signingClose) {
      while ($cursor -lt $signingClose -and [char]::IsWhiteSpace($BuildGradle[$cursor])) {
        $cursor += 1
      }

      $remaining = $BuildGradle.Substring($cursor, $signingClose - $cursor)
      $releaseMatch = [regex]::Match($remaining, "\Arelease\s*\{")
      if ($releaseMatch.Success) {
        $releaseOpen = $BuildGradle.IndexOf("{", $cursor)
        $releaseClose = Find-MatchingBrace -Text $BuildGradle -OpenBraceIndex $releaseOpen
        if ($releaseClose -lt 0) {
          return $BuildGradle
        }

        $releaseBlock = $BuildGradle.Substring($cursor, $releaseClose - $cursor + 1)
        if ($releaseBlock -match "TRAVELFRAME_UPLOAD_STORE_FILE") {
          $cursor = $releaseClose + 1
          continue
        }

        $removeEnd = $releaseClose + 1
        if ($removeEnd + 1 -lt $BuildGradle.Length -and $BuildGradle.Substring($removeEnd, 2) -eq "`r`n") {
          $removeEnd += 2
        } elseif ($removeEnd -lt $BuildGradle.Length -and $BuildGradle[$removeEnd] -eq "`n") {
          $removeEnd += 1
        }

        $BuildGradle = $BuildGradle.Remove($cursor, $removeEnd - $cursor)
        $removed = $true
        break
      }

      $nextOpen = $BuildGradle.IndexOf("{", $cursor)
      if ($nextOpen -lt 0 -or $nextOpen -gt $signingClose) {
        break
      }

      $nextClose = Find-MatchingBrace -Text $BuildGradle -OpenBraceIndex $nextOpen
      if ($nextClose -lt 0) {
        break
      }

      $cursor = $nextClose + 1
    }

    if (-not $removed) {
      return $BuildGradle
    }
  }
}

function Import-SigningEnvFile {
  param([string]$Path)

  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
    return
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf("=")
    if ($separatorIndex -le 0) {
      continue
    }

    $name = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if ($name -and -not [System.Environment]::GetEnvironmentVariable($name, "Process")) {
      Set-Item -Path "Env:$name" -Value $value
    }
  }
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

$env:GRADLE_USER_HOME = Join-Path $projectRoot ".gradle-local"
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null
Write-Host "Using project Gradle cache: $env:GRADLE_USER_HOME"

if (-not $SigningEnvPath) {
  $SigningEnvPath = Join-Path $projectRoot "credentials\android\signing.env"
}
Import-SigningEnvFile -Path $SigningEnvPath

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
  $versionCodeStatePath = Join-Path $projectRoot ".android-version-code"
  $baseVersionCode = [int](Get-Date -Format "yyMMddHH")
  $lastVersionCode = 0

  if (Test-Path -LiteralPath $versionCodeStatePath) {
    $lastVersionCodeText = (Get-Content -LiteralPath $versionCodeStatePath -Raw).Trim()
    if ($lastVersionCodeText -match "^\d+$") {
      $lastVersionCode = [int]$lastVersionCodeText
    }
  }

  if ($lastVersionCode -gt 0) {
    $VersionCode = [Math]::Max($baseVersionCode, $lastVersionCode + 1)
  } else {
    $VersionCode = $baseVersionCode + 1
  }
}

if ($VersionCode -gt 2100000000) {
  Stop-WithMessage "Android versionCode must be 2100000000 or lower for Google Play."
}

Set-Content -LiteralPath (Join-Path $projectRoot ".android-version-code") -Value $VersionCode -Encoding ASCII

Write-Host "Preparing Android project..." -ForegroundColor Cyan
Invoke-External "npx" @("expo", "prebuild", "--platform", "android", "--no-install")
Remove-DuplicateLauncherPngResources -ProjectRoot $projectRoot

$buildGradlePath = Join-Path $projectRoot "android\app\build.gradle"
if (-not (Test-Path $buildGradlePath)) {
  Stop-WithMessage "android\app\build.gradle was not generated."
}

$buildGradle = Get-Content -LiteralPath $buildGradlePath -Raw
$buildGradle = Remove-ReleaseSigningConfigBlock -BuildGradle $buildGradle

if ($buildGradle -notmatch "TRAVELFRAME_UPLOAD_STORE_FILE") {
  $releaseSigning = @"
def requestedTasksForSigning = gradle.startParameter.taskNames.collect { it.toLowerCase() }
def requiresReleaseSigning = requestedTasksForSigning.any {
        it.contains("release") || it.contains("bundle")
    }

signingConfigs {
        release {
            // TRAVELFRAME_UPLOAD_STORE_FILE
            def uploadStoreFile = System.getenv("ANDROID_KEYSTORE_PATH")
            def uploadStorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            def uploadKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
            def uploadKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            if (requiresReleaseSigning && (uploadStoreFile == null || uploadStorePassword == null || uploadKeyAlias == null || uploadKeyPassword == null)) {
                throw new GradleException("Android release signing environment variables are missing.")
            }
            if (uploadStoreFile != null && uploadStorePassword != null && uploadKeyAlias != null && uploadKeyPassword != null) {
                storeFile file(uploadStoreFile)
                storePassword uploadStorePassword
                keyAlias uploadKeyAlias
                keyPassword uploadKeyPassword
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
"@
  $buildGradle = $buildGradle -replace "signingConfigs\s*\{", $releaseSigning
}

$buildGradle = [regex]::Replace($buildGradle, "versionCode\s+\d+", "versionCode $VersionCode", 1)
$buildGradle = [regex]::Replace(
  $buildGradle,
  "(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug",
  '${1}signingConfigs.release',
  1
)

Write-Utf8NoBom -Path $buildGradlePath -Value $buildGradle

Write-Host "Building AAB with versionCode $VersionCode..." -ForegroundColor Cyan
Push-Location (Join-Path $projectRoot "android")
try {
  Invoke-External ".\gradlew.bat" @("--no-daemon", "--no-parallel", "--max-workers=2", "--console=plain", "bundleRelease")
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
