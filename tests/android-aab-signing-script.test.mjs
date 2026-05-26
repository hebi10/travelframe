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
  source.indexOf(cleanupCall) < source.indexOf('$buildGradle = $buildGradle -replace "signingConfigs\\s*\\{"'),
  "release signing cleanup should run before the signingConfigs replacement"
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

console.log("ok - Android AAB signing script configures release signing and R8 mapping output");
