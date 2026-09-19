$ErrorActionPreference = 'Stop'
$source = Get-Content (Join-Path $PSScriptRoot '../scripts/build-android-aab.ps1') -Raw
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$null, [ref]$null)
foreach ($name in @('Set-RequiredBuildGradleReplacement', 'Set-ReleaseBuildSigningConfig', 'Assert-AndroidAabBuildGradle')) {
  $definition = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
  . ([scriptblock]::Create($definition.Extent.Text))
}
function Stop-WithMessage { param([string]$Message) throw $Message }

foreach ($separator in @(' ', ' = ')) {
  foreach ($existing in @('debug', 'release')) {
    $fixture = @"
// TRAVELFRAME_UPLOAD_STORE_FILE
versionCode 42
buildTypes {
  debug { signingConfig = signingConfigs.debug }
  release {
    signingConfig${separator}signingConfigs.$existing
    minifyEnabled enableMinifyInReleaseBuilds
    proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
  }
}
"@
    $result = Set-ReleaseBuildSigningConfig -BuildGradle $fixture
    if ($result -notmatch 'debug \{ signingConfig = signingConfigs.debug \}') { throw 'Debug signing changed' }
    if ($result -notmatch 'release\s*\{\s*signingConfig\s+(?:=\s*)?signingConfigs.release') { throw 'Release signing was not configured' }
    Assert-AndroidAabBuildGradle -BuildGradle $result -VersionCode 42
    if ((Set-ReleaseBuildSigningConfig -BuildGradle $result) -cne $result) { throw 'Signing mutation is not idempotent' }
  }
}
Write-Output 'PASS: both Groovy signing assignment forms, debug preservation, validation, and repeated builds'
