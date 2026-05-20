$ErrorActionPreference = "Stop"

$preferredJavaHome = "C:\Program Files\Java\jdk-24"
$preferredJava = Join-Path $preferredJavaHome "bin\java.exe"

if (Test-Path $preferredJava) {
  $env:JAVA_HOME = $preferredJavaHome
  $env:PATH = "$(Join-Path $preferredJavaHome "bin");$env:PATH"
}

firebase emulators:exec "node tests/firebase-rules-emulator-runner.mjs" --only firestore,storage --log-verbosity SILENT
exit $LASTEXITCODE
