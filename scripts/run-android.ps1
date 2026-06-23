param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExpoArgs = @()
)

$ErrorActionPreference = "Stop"

function Get-ShortGradleUserHome {
  if ($env:TRAVEL_FRAME_GRADLE_USER_HOME) {
    return $env:TRAVEL_FRAME_GRADLE_USER_HOME
  }

  return "C:\g"
}

function Get-AndroidCxxCachePaths {
  param([string]$ProjectRoot)

  $paths = @()
  $appCxxPath = Join-Path $ProjectRoot "android\app\.cxx"
  if (Test-Path -LiteralPath $appCxxPath) {
    $paths += $appCxxPath
  }

  $nodeModulesPath = Join-Path $ProjectRoot "node_modules"
  if (Test-Path -LiteralPath $nodeModulesPath) {
    $paths += Get-ChildItem -LiteralPath $nodeModulesPath -Directory -Recurse -Filter ".cxx" -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName.EndsWith("\android\.cxx", [System.StringComparison]::OrdinalIgnoreCase) } |
      ForEach-Object { $_.FullName }
  }

  $paths | Sort-Object -Unique
}

function Clear-StaleAndroidCxxCache {
  param([string]$ProjectRoot)

  foreach ($cxxPath in Get-AndroidCxxCachePaths -ProjectRoot $ProjectRoot) {
    $staleFiles = Get-ChildItem -LiteralPath $cxxPath -Recurse -File -Include "build.ninja", "compile_commands.json", "CMakeCache.txt" -ErrorAction SilentlyContinue |
      Select-String -SimpleMatch ".gradle-local" -List -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if (-not $staleFiles) {
      continue
    }

    Write-Host "Clearing stale Android CMake cache: $cxxPath"
    Remove-Item -LiteralPath $cxxPath -Recurse -Force
  }
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

$env:GRADLE_USER_HOME = Get-ShortGradleUserHome
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null
Clear-StaleAndroidCxxCache -ProjectRoot $projectRoot

Write-Host "Using short Gradle cache: $env:GRADLE_USER_HOME"

& npx expo run:android @ExpoArgs
exit $LASTEXITCODE
