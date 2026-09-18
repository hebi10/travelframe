import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const quality = fs.readFileSync(".github/workflows/quality.yml", "utf8");
const plugin = fs.readFileSync("plugins/with-android-release-manifest.js", "utf8");
const secretWorkflow = fs.readFileSync(".github/workflows/secret-scan.yml", "utf8");

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

const qualityTestIndex = quality.indexOf("run: npm test");
const qualityPrebuildIndex = quality.indexOf("run: npm run android:prebuild:ci");
assert.ok(
  qualityPrebuildIndex >= 0 && qualityPrebuildIndex < qualityTestIndex,
  "Quality must prebuild Android before tests inspect generated files"
);
const androidVerifyIndex = quality.indexOf("run: npm run android:verify:kotlin");
const androidJobPrebuildIndex = quality.lastIndexOf(
  "run: npm run android:prebuild:ci",
  androidVerifyIndex
);
assert.ok(
  androidJobPrebuildIndex >= 0 && androidJobPrebuildIndex < androidVerifyIndex,
  "Android CI must prebuild before Kotlin verification"
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
  "config plugin should own deterministic generated ProGuard rules"
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
  "history secret scan must remain enabled"
);

assert.ok(fs.existsSync("docs/release-assets/README.md"));
const assets = fs.readFileSync("docs/release-assets/README.md", "utf8");
for (const token of [
  "Firebase에 업로드하지 않습니다",
  "Google Play Console",
  "assets/icons",
  "Google Drive"
]) {
  assert.ok(assets.includes(token), `release asset manifest should contain ${token}`);
}

const releaseVerify = fs.readFileSync(
  "scripts/verify-release-readiness.mjs",
  "utf8"
);
for (const token of [
  "바디 프레임",
  "com.haebi.photoguide",
  "ad_remove",
  "creator_monthly",
  "expert_monthly",
  "app-icon.png",
  "adaptive-icon.png",
  "splash-icon.png"
]) {
  assert.ok(releaseVerify.includes(token), `release verifier should check ${token}`);
}

console.log("ok - Body Frame stage 8 release readiness contracts are enforced");
