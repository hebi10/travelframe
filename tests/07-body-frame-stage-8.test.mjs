import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const quality = fs.readFileSync(".github/workflows/quality.yml", "utf8");
const plugin = fs.readFileSync("plugins/with-android-release-manifest.js", "utf8");
const patchScript = fs.readFileSync("scripts/apply-patches.mjs", "utf8");
const buildAab = fs.readFileSync("scripts/build-android-aab.ps1", "utf8");
const secretWorkflow = fs.readFileSync(".github/workflows/secret-scan.yml", "utf8");
const imageBackupTest = fs.readFileSync("tests/image-backup-utils.test.mjs", "utf8");

assert.equal(
  packageJson.scripts?.["android:prebuild:ci"],
  "node scripts/prebuild-android-ci.mjs"
);
assert.equal(
  packageJson.scripts?.["release:verify"],
  "node scripts/verify-release-readiness.mjs"
);
assert.ok(fs.existsSync("scripts/prebuild-android-ci.mjs"));
assert.ok(fs.existsSync("scripts/verify-release-readiness.mjs"));

const prebuildSource = fs.readFileSync("scripts/prebuild-android-ci.mjs", "utf8");
assert.ok(
  prebuildSource.includes('"--clean"') &&
    prebuildSource.indexOf('"prebuild"') <
      prebuildSource.lastIndexOf("scripts/apply-patches.mjs"),
  "clean Expo prebuild must run before node_modules patches are reapplied"
);

const qualityTestIndex = quality.indexOf("run: npm test");
const qualityPrebuildIndex = quality.indexOf("run: npm run android:prebuild:ci");
const releaseVerifyIndex = quality.indexOf("run: npm run release:verify");
assert.ok(
  qualityPrebuildIndex >= 0 &&
    qualityPrebuildIndex < releaseVerifyIndex &&
    releaseVerifyIndex < qualityTestIndex,
  "Quality must prebuild and verify release sources before generated-Android tests"
);

const androidVerifyIndex = quality.indexOf("run: npm run android:verify:kotlin");
const androidJobPrebuildIndex = quality.lastIndexOf(
  "run: npm run android:prebuild:ci",
  androidVerifyIndex
);
assert.ok(
  androidJobPrebuildIndex >= 0 && androidJobPrebuildIndex < androidVerifyIndex,
  "Windows Android CI must prebuild before Kotlin verification"
);

for (const snippet of [
  "-keep class com.margelo.nitro.camera.** { *; }",
  "-keep class com.margelo.nitro.image.** { *; }",
  "-keep class com.mrousavy.camera.** { *; }",
  "-keep class com.google.android.gms.ads.** { *; }"
]) {
  assert.ok(plugin.includes(snippet), `config plugin must generate R8 rule: ${snippet}`);
}
assert.ok(
  plugin.includes("ensureReleaseProguardRules"),
  "config plugin should own generated ProGuard rules"
);
assert.ok(
  plugin.includes("android.permission.SYSTEM_ALERT_WINDOW") &&
    plugin.includes("RELEASE_BLOCKED_PERMISSIONS"),
  "generated release manifest should remove known unwanted permissions"
);

assert.ok(
  patchScript.includes("foojay-resolver-convention") &&
    patchScript.includes('"1.0.0"') &&
    patchScript.includes("patchReactNativeGradleFoojayResolver"),
  "React Native Gradle plugin should patch Foojay resolver to the Gradle 9 compatible version"
);
assert.ok(
  patchScript.includes("CameraInfo.mustPlayShutterSound()") &&
    patchScript.includes("unsupported CameraInfo.mustPlayShutterSound() usage"),
  "VisionCamera patch should fail fast on unsupported shutter-sound source"
);

const prebuildCall = 'Invoke-External "npx" @("expo", "prebuild", "--platform", "android", "--no-install")';
const reapplyCall = 'Invoke-External "node" @("scripts/apply-patches.mjs")';
assert.ok(
  buildAab.lastIndexOf(reapplyCall) > buildAab.indexOf(prebuildCall),
  "local AAB build must reapply node_modules patches after Expo prebuild"
);

assert.ok(fs.existsSync(".gitleaksignore"));
const ignore = fs.readFileSync(".gitleaksignore", "utf8");
for (const line of ["568", "577", "579", "581"]) {
  assert.ok(
    ignore.includes(`:firebase-debug.log:generic-api-key:${line}`),
    `legacy Gitleaks fingerprint ${line} must be explicitly ignored`
  );
}
assert.ok(
  secretWorkflow.includes("security:secrets:history"),
  "full-history secret scan must remain enabled"
);

assert.ok(
  imageBackupTest.includes('fs.readFileSync("constants/body-frame.ts"') &&
    imageBackupTest.includes('from "\@/constants/body-frame"') &&
    imageBackupTest.includes("bodyFrameModuleUrl"),
  "image backup data-URL harness must rewrite the Body Frame constants alias"
);

for (const file of [
  "docs/release-assets/README.md",
  "docs/body-frame-release-checklist.md"
]) {
  assert.ok(fs.existsSync(file), `release document should exist: ${file}`);
}
const assets = fs.readFileSync("docs/release-assets/README.md", "utf8");
for (const token of [
  "BF 모노그램 v2",
  "Firebase에 업로드하지 않습니다",
  "Google Play Console",
  "assets/icons"
]) {
  assert.ok(assets.includes(token), `release asset documentation should contain ${token}`);
}

const releaseVerify = fs.readFileSync("scripts/verify-release-readiness.mjs", "utf8");
for (const token of [
  "바디 프레임",
  "com.haebi.photoguide",
  "ad_remove",
  "creator_monthly",
  "expert_monthly",
  "app-icon.png",
  "adaptive-icon.png",
  "splash-icon.png",
  "#0B0B0C"
]) {
  assert.ok(releaseVerify.includes(token), `release verifier should check ${token}`);
}

console.log("ok - Body Frame Stage 8 release readiness contracts are enforced");
