param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExpoArgs = @()
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

$metroPort = 8081
$listeners = Get-NetTCPConnection -LocalPort $metroPort -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  if ($process -and $process.ProcessName -eq "node") {
    Write-Host "Stopping existing Metro server on port $metroPort (PID $($process.Id))"
    Stop-Process -Id $process.Id -Force
  }
}

Remove-Item "$env:TEMP\metro-cache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\metro-file-map-*" -Force -ErrorAction SilentlyContinue
Remove-Item ".expo\cache" -Recurse -Force -ErrorAction SilentlyContinue

& npx expo start -c --dev-client --android @ExpoArgs
exit $LASTEXITCODE
