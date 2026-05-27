param(
  [ValidateSet("Kotlin", "Assemble", "ManifestDebug", "ManifestRelease")]
  [string]$Mode = "Kotlin",
  [int]$TimeoutSeconds = 300,
  [string]$NativeArchitectures = "",
  [int]$LogTailLines = 160,
  [switch]$Offline,
  [switch]$KillStaleProcesses
)

$ErrorActionPreference = "Stop"

function Stop-BuildProcesses {
  param(
    [datetime]$Since,
    [string]$ProjectRoot,
    [switch]$IncludeExisting
  )

  $names = if ($IncludeExisting) {
    @("gradle", "cmake", "ninja")
  } else {
    @("java", "gradle", "cmake", "ninja", "clang", "clang++", "cl", "link")
  }
  $normalizedProjectRoot = $ProjectRoot.ToLowerInvariant()
  $processes = Get-CimInstance Win32_Process |
    Where-Object {
      $processName = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
      $commandLine = if ($_.CommandLine) { $_.CommandLine.ToLowerInvariant() } else { "" }
      $names -contains $processName -and $commandLine.Contains($normalizedProjectRoot)
    }
  if (-not $processes) {
    return
  }

  if (-not $IncludeExisting) {
    $cutoff = $Since.AddSeconds(-2)
    $processes = $processes | Where-Object {
      try {
        [System.Management.ManagementDateTimeConverter]::ToDateTime($_.CreationDate) -ge $cutoff
      } catch {
        $false
      }
    }
  }

  foreach ($process in $processes) {
    try {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
      Write-Host "Stopped stale Android build process: $($process.Name) ($($process.ProcessId))" -ForegroundColor Yellow
    } catch {
      Write-Host "Could not stop process $($process.Name) ($($process.ProcessId)): $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }
}

function Stop-WithMessage {
  param([string]$Message)
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  exit 1
}

if ($TimeoutSeconds -lt 30) {
  Stop-WithMessage "TimeoutSeconds must be at least 30."
}
if ($LogTailLines -lt 20) {
  Stop-WithMessage "LogTailLines must be at least 20."
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$androidRoot = Join-Path $projectRoot "android"
$gradlew = Join-Path $androidRoot "gradlew.bat"

if (-not (Test-Path -LiteralPath $gradlew)) {
  Stop-WithMessage "android\gradlew.bat was not found. Run expo prebuild first."
}

if ($KillStaleProcesses) {
  Stop-BuildProcesses -Since (Get-Date) -ProjectRoot $projectRoot -IncludeExisting
}

$env:GRADLE_USER_HOME = Join-Path $projectRoot ".gradle-local"
$env:ANDROID_USER_HOME = Join-Path $projectRoot ".tmp\android-home"
if (-not $env:NODE_ENV) {
  $env:NODE_ENV = "development"
}

New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME | Out-Null

$task = switch ($Mode) {
  "Assemble" { ":app:assembleDebug" }
  "ManifestDebug" { ":app:processDebugMainManifest" }
  "ManifestRelease" { ":app:processReleaseMainManifest" }
  default { ":app:compileDebugKotlin" }
}
$arguments = @(
  "--no-daemon",
  "--no-parallel",
  "--max-workers=1",
  "--console=plain",
  "-Pkotlin.compiler.execution.strategy=in-process"
)
if ($NativeArchitectures) {
  $arguments += "-PreactNativeArchitectures=$NativeArchitectures"
}
if ($Offline) {
  $arguments += "--offline"
}
$arguments += $task

Write-Host "Running Android $Mode verification with $TimeoutSeconds second timeout..." -ForegroundColor Cyan
if ($NativeArchitectures) {
  Write-Host "Using React Native architectures: $NativeArchitectures"
}
Write-Host "Using project Gradle cache: $env:GRADLE_USER_HOME"
Write-Host "Using Android user home: $env:ANDROID_USER_HOME"

$startedAt = Get-Date
$stdoutLog = Join-Path $env:ANDROID_USER_HOME "android-$Mode-stdout.log"
$stderrLog = Join-Path $env:ANDROID_USER_HOME "android-$Mode-stderr.log"
Remove-Item -LiteralPath $stdoutLog, $stderrLog -Force -ErrorAction SilentlyContinue
$process = Start-Process -FilePath $gradlew -ArgumentList $arguments -WorkingDirectory $androidRoot -NoNewWindow -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
$finished = $process.WaitForExit($TimeoutSeconds * 1000)
$stdout = if (Test-Path -LiteralPath $stdoutLog) { Get-Content -LiteralPath $stdoutLog -Raw } else { "" }
$stderr = if (Test-Path -LiteralPath $stderrLog) { Get-Content -LiteralPath $stderrLog -Raw } else { "" }
$combinedOutput = "$stdout`n$stderr"

if ($stdout) {
  Write-Host $stdout
}
if ($stderr) {
  Write-Host $stderr
}

if (-not $finished) {
  if (Test-Path -LiteralPath $stdoutLog) {
    Write-Host ""
    Write-Host "Last $LogTailLines stdout lines before timeout:" -ForegroundColor Yellow
    Get-Content -LiteralPath $stdoutLog -Tail $LogTailLines
  }
  if (Test-Path -LiteralPath $stderrLog) {
    Write-Host ""
    Write-Host "Last $LogTailLines stderr lines before timeout:" -ForegroundColor Yellow
    Get-Content -LiteralPath $stderrLog -Tail $LogTailLines
  }
  Stop-BuildProcesses -Since $startedAt -ProjectRoot $projectRoot
  Stop-WithMessage "Android $Mode verification timed out after $TimeoutSeconds seconds. Stale native build processes were stopped."
}

$process.Refresh()
$exitCode = $process.ExitCode
if ($null -eq $exitCode) {
  $exitCode = 1
}

if ($exitCode -ne 0 -and $combinedOutput.Contains("BUILD SUCCESSFUL")) {
  Write-Host "Gradle reported BUILD SUCCESSFUL even though the wrapper process returned exit code $exitCode; treating this as a passed verification." -ForegroundColor Yellow
  $exitCode = 0
}

if ($exitCode -ne 0) {
  Stop-BuildProcesses -Since $startedAt -ProjectRoot $projectRoot
  Stop-WithMessage "Android $Mode verification failed with exit code $exitCode."
}

Write-Host ""
Write-Host "Android $Mode verification passed." -ForegroundColor Green
