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

function Set-GradleProperty {
  param(
    [string]$Path,
    [string]$Name,
    [string]$Value
  )

  if (Test-Path -LiteralPath $Path) {
    $content = Get-Content -LiteralPath $Path -Raw
  } else {
    $content = ""
  }

  $line = "$Name=$Value"
  if ($content -match "(?m)^$([regex]::Escape($Name))=") {
    $content = [regex]::Replace($content, "(?m)^$([regex]::Escape($Name))=.*$", $line, 1)
  } else {
    if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) {
      $content += "`r`n"
    }
    $content += "$line`r`n"
  }

  Write-Utf8NoBom -Path $Path -Value $content
}

function Get-LastAndroidVersionCode {
  param([string]$ProjectRoot)

  $versionCodeStatePath = Join-Path $ProjectRoot ".android-version-code"

  if (Test-Path -LiteralPath $versionCodeStatePath) {
    $lastVersionCodeText = (Get-Content -LiteralPath $versionCodeStatePath -Raw).Trim()
    if ($lastVersionCodeText -match "^\d+$") {
      return [int]$lastVersionCodeText
    }
  }

  return 0
}

# Local AAB versionCode source of truth:
# - explicit -VersionCode wins when provided, but must increase .android-version-code
# - otherwise .android-version-code is advanced monotonically from yyMMddHH
# - app.json expo.android.versionCode is ignored by local AAB builds
# - EAS remote appVersionSource remains separate for `npm run android:build-prod`
function Get-NextAndroidVersionCode {
  param([string]$ProjectRoot)

  $baseVersionCode = [int](Get-Date -Format "yyMMddHH")
  $lastVersionCode = Get-LastAndroidVersionCode -ProjectRoot $ProjectRoot

  if ($lastVersionCode -gt 0) {
    return [Math]::Max($baseVersionCode, $lastVersionCode + 1)
  }

  return $baseVersionCode + 1
}

function Assert-ManualAndroidVersionCode {
  param(
    [string]$ProjectRoot,
    [int]$VersionCode
  )

  $lastVersionCode = Get-LastAndroidVersionCode -ProjectRoot $ProjectRoot
  if ($lastVersionCode -gt 0 -and $VersionCode -le $lastVersionCode) {
    Stop-WithMessage "Manual -VersionCode $VersionCode must be greater than the previous local AAB versionCode $lastVersionCode from .android-version-code."
  }
}

function Write-LocalVersionCodePolicyNotice {
  param([string]$ProjectRoot)

  $appJsonPath = Join-Path $ProjectRoot "app.json"
  if (-not (Test-Path -LiteralPath $appJsonPath)) {
    return
  }

  $appJson = Get-Content -LiteralPath $appJsonPath -Raw
  if ($appJson -match '"versionCode"\s*:') {
    Write-Warning "app.json expo.android.versionCode is ignored by local AAB builds; use -VersionCode or .android-version-code for scripts/build-android-aab.ps1. EAS remote appVersionSource remains separate for npm run android:build-prod."
  }
}

function Set-RequiredBuildGradleReplacement {
  param(
    [string]$Text,
    [string]$Pattern,
    [string]$Replacement,
    [string]$Description
  )

  $matches = [regex]::Matches($Text, $Pattern)
  if ($matches.Count -ne 1) {
    Stop-WithMessage "Expected exactly one build.gradle match for $Description, found $($matches.Count). Refusing to continue after prebuild."
  }

  return [regex]::Replace($Text, $Pattern, $Replacement, 1)
}

function Set-ReleaseBuildSigningConfig {
  param([string]$BuildGradle)

  $releasePattern = "(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.release"
  $releaseSigningConfigMatches = [regex]::Matches($BuildGradle, $releasePattern)
  if ($releaseSigningConfigMatches.Count -eq 1) {
    return $BuildGradle
  }
  if ($releaseSigningConfigMatches.Count -gt 1) {
    Stop-WithMessage "Expected at most one build.gradle match for existing release signingConfig, found $($releaseSigningConfigMatches.Count). Refusing to continue after prebuild."
  }

  return Set-RequiredBuildGradleReplacement `
    -Text $BuildGradle `
    -Pattern "(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug" `
    -Replacement '${1}signingConfigs.release' `
    -Description "release signingConfig"
}

function Assert-AndroidAabBuildGradle {
  param(
    [string]$BuildGradle,
    [int]$VersionCode
  )

  $versionMatches = [regex]::Matches($BuildGradle, "versionCode\s+$VersionCode\b")
  if ($versionMatches.Count -ne 1) {
    Stop-WithMessage "Generated build.gradle does not contain exactly one local AAB versionCode $VersionCode."
  }

  foreach ($requiredSnippet in @(
    "TRAVELFRAME_UPLOAD_STORE_FILE",
    "signingConfig signingConfigs.release",
    "minifyEnabled enableMinifyInReleaseBuilds",
    "proguardFiles getDefaultProguardFile"
  )) {
    if (-not $BuildGradle.Contains($requiredSnippet)) {
      Stop-WithMessage "Generated build.gradle is missing required release setting: $requiredSnippet"
    }
  }
}

function Assert-VisionCameraAndroidShutterSoundPatch {
  param([string]$ProjectRoot)

  $packageJsonPath = Join-Path $ProjectRoot "package.json"
  if (-not (Test-Path -LiteralPath $packageJsonPath)) {
    Stop-WithMessage "package.json was not found; cannot verify required VisionCamera Android patch."
  }

  $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
  $declaresVisionCamera = $false
  if ($packageJson.dependencies) {
    $declaresVisionCamera = $packageJson.dependencies.PSObject.Properties.Name -contains "react-native-vision-camera"
  }
  if (-not $declaresVisionCamera) {
    return
  }

  $visionCameraOutputPath = Join-Path $ProjectRoot "node_modules\react-native-vision-camera\android\src\main\java\com\margelo\nitro\camera\hybrids\outputs\HybridPhotoOutput.kt"
  if (-not (Test-Path -LiteralPath $visionCameraOutputPath)) {
    Stop-WithMessage "react-native-vision-camera is declared but its Android output source was not found. Run npm install before building the local AAB."
  }

  $source = Get-Content -LiteralPath $visionCameraOutputPath -Raw
  if (-not $source.Contains("val enableShutterSound = settings.enableShutterSound ?: true")) {
    Stop-WithMessage "Required VisionCamera Android shutter sound patch was not applied."
  }
  if ($source.Contains("CameraInfo.mustPlayShutterSound()")) {
    Stop-WithMessage "Required VisionCamera Android shutter sound patch is incomplete; CameraInfo.mustPlayShutterSound() is still present."
  }
}

function Assert-AndroidR8MappingFile {
  param([string]$ProjectRoot)

  $mappingPath = Join-Path $ProjectRoot "android\app\build\outputs\mapping\release\mapping.txt"
  if (-not (Test-Path -LiteralPath $mappingPath)) {
    Stop-WithMessage "R8 mapping file was not found. Release candidate AAB builds must produce android\app\build\outputs\mapping\release\mapping.txt before uploading to Google Play."
  }

  Write-Host ""
  Write-Host "R8 mapping file created for Google Play:" -ForegroundColor Green
  Write-Host $mappingPath
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

$manualVersionCodeProvided = $PSBoundParameters.ContainsKey("VersionCode") -and $VersionCode -gt 0
if ($VersionCode -le 0) {
  $VersionCode = Get-NextAndroidVersionCode -ProjectRoot $projectRoot
} elseif ($manualVersionCodeProvided) {
  Assert-ManualAndroidVersionCode -ProjectRoot $projectRoot -VersionCode $VersionCode
}

if ($VersionCode -gt 2100000000) {
  Stop-WithMessage "Android versionCode must be 2100000000 or lower for Google Play."
}

Set-Content -LiteralPath (Join-Path $projectRoot ".android-version-code") -Value $VersionCode -Encoding ASCII
Write-LocalVersionCodePolicyNotice -ProjectRoot $projectRoot

Write-Host "Preparing Android project..." -ForegroundColor Cyan
Invoke-External "node" @("scripts/apply-patches.mjs")
Assert-VisionCameraAndroidShutterSoundPatch -ProjectRoot $projectRoot
Invoke-External "npx" @("expo", "prebuild", "--platform", "android", "--no-install")
Remove-DuplicateLauncherPngResources -ProjectRoot $projectRoot

$gradlePropertiesPath = Join-Path $projectRoot "android\gradle.properties"
Set-GradleProperty -Path $gradlePropertiesPath -Name "android.enableMinifyInReleaseBuilds" -Value "true"
Set-GradleProperty -Path $gradlePropertiesPath -Name "android.enableShrinkResourcesInReleaseBuilds" -Value "true"

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
  $buildGradle = Set-RequiredBuildGradleReplacement -Text $buildGradle -Pattern "signingConfigs\s*\{" -Replacement $releaseSigning -Description "release signing config insertion"
}

$buildGradle = Set-RequiredBuildGradleReplacement -Text $buildGradle -Pattern "versionCode\s+\d+" -Replacement "versionCode $VersionCode" -Description "local versionCode"
$buildGradle = Set-ReleaseBuildSigningConfig -BuildGradle $buildGradle

Assert-AndroidAabBuildGradle -BuildGradle $buildGradle -VersionCode $VersionCode

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

Assert-AndroidR8MappingFile -ProjectRoot $projectRoot
