import assert from "node:assert/strict";
import fs from "node:fs";

const scriptPath = "scripts/build-android-aab.ps1";
const source = fs.readFileSync(scriptPath, "utf8");

assert.ok(
  source.includes("function Remove-ReleaseSigningConfigBlock"),
  "AAB build script should define a release signing config cleanup helper"
);

const cleanupCall = "$buildGradle = Remove-ReleaseSigningConfigBlock -BuildGradle $buildGradle";
assert.ok(
  source.includes(cleanupCall),
  "AAB build script should remove generated release signing config before injecting its own"
);

assert.ok(
  source.indexOf(cleanupCall) <
    source.indexOf('Set-RequiredBuildGradleReplacement -Text $buildGradle -Pattern "signingConfigs\\s*\\{"'),
  "release signing cleanup should run before the checked signingConfigs replacement"
);

assert.ok(
  source.includes('"--no-parallel"'),
  "AAB build should disable Gradle parallel execution to avoid Windows transform cache move races"
);

assert.ok(
  source.includes('Set-GradleProperty -Path $gradlePropertiesPath -Name "android.enableMinifyInReleaseBuilds" -Value "true"'),
  "AAB build should enable release minification so R8 generates mapping.txt"
);

assert.ok(
  source.includes('Set-GradleProperty -Path $gradlePropertiesPath -Name "android.enableShrinkResourcesInReleaseBuilds" -Value "true"'),
  "AAB build should enable release resource shrinking alongside R8"
);

assert.ok(
  source.includes("android\\app\\build\\outputs\\mapping\\release\\mapping.txt"),
  "AAB build should print the generated R8 mapping file path"
);

assert.ok(
  source.includes("Local AAB versionCode source of truth"),
  "AAB script should document that local builds own versionCode independently from app.json and EAS remote"
);

assert.ok(
  source.includes("Get-NextAndroidVersionCode"),
  "AAB script should keep local versionCode generation in a named helper"
);

assert.ok(
  source.includes("Get-LastAndroidVersionCode"),
  "AAB script should read the last local versionCode state in a named helper"
);

assert.ok(
  source.includes('$PSBoundParameters.ContainsKey("VersionCode")') &&
    source.includes("must be greater than the previous local AAB versionCode"),
  "AAB script should reject manual -VersionCode values that do not increase .android-version-code"
);

assert.ok(
  source.includes("Set-RequiredBuildGradleReplacement"),
  "AAB script should fail when required build.gradle replacements do not match exactly once"
);

assert.ok(
  source.includes("function Set-ReleaseBuildSigningConfig"),
  "AAB script should handle release signingConfig mutation in a named helper"
);

assert.ok(
  source.includes("if ($releaseSigningConfigMatches.Count -eq 1) {") &&
    source.includes("return $BuildGradle"),
  "AAB script should accept a prebuild file that already uses signingConfigs.release"
);

assert.ok(
  source.includes("Assert-AndroidAabBuildGradle"),
  "AAB script should validate generated build.gradle after prebuild mutation"
);

assert.ok(
  source.includes("Assert-AndroidR8MappingFile") &&
    source.includes("R8 mapping file was not found"),
  "AAB script should fail release candidate builds when R8 mapping.txt is missing"
);

assert.ok(
  source.includes("app.json expo.android.versionCode is ignored by local AAB builds"),
  "AAB script should warn when app.json still has an Android versionCode that local builds ignore"
);

console.log("ok - Android AAB signing script configures release signing, local versionCode, and R8 mapping output");
