import assert from "node:assert/strict";
import fs from "node:fs";

const patchScript = fs.readFileSync("scripts/apply-patches.mjs", "utf8");
const proguardRules = fs.readFileSync("android/app/proguard-rules.pro", "utf8");

assert.equal(
  fs.existsSync("patches/expo-camera+55.0.0.patch"),
  false,
  "obsolete expo-camera patch file should be removed after migrating Android camera capture to VisionCamera"
);

assert.equal(
  patchScript.includes("expoCameraRoot"),
  false,
  "postinstall patch script should not retain inactive expo-camera patch plumbing"
);

assert.equal(
  patchScript.includes("replaceIfFound"),
  false,
  "patch script should not silently skip important replacements through replaceIfFound"
);

assert.ok(
  patchScript.includes("replaceOptional"),
  "patch script should keep an explicit helper for optional cleanup replacements"
);

assert.ok(
  patchScript.includes("replaceRequiredOneOf"),
  "patch script should fail when required package patch variants are not found"
);

assert.ok(
  patchScript.includes("VisionCamera Android shutter sound override"),
  "VisionCamera shutter sound patch should be labeled as a required patch"
);

for (const snippet of [
  "-keep class com.margelo.nitro.camera.** { *; }",
  "-keep class com.margelo.nitro.image.** { *; }",
  "-keep class com.mrousavy.camera.** { *; }",
  "-keep class com.google.android.gms.ads.** { *; }"
]) {
  assert.ok(proguardRules.includes(snippet), `release R8 keep rule missing: ${snippet}`);
}

console.log("ok - Android postinstall patches and R8 keep rules fail loudly for release builds");
