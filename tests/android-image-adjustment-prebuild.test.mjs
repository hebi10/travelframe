import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appConfig = JSON.parse(readFileSync("app.json", "utf8"));
const gitignore = readFileSync(".gitignore", "utf8");
const androidReleaseManifestPlugin = readFileSync(
  "plugins/with-android-release-manifest.js",
  "utf8"
);

assert.match(
  gitignore,
  /^android\/$/m,
  "android/ should stay ignored so managed/prebuild output is not committed"
);

assert.ok(
  appConfig.expo?.plugins?.includes("./plugins/with-android-release-manifest"),
  "app config should run the Android prebuild plugin"
);

for (const snippet of [
  "withDangerousMod",
  "withMainApplication",
  "config.android?.package",
  "androidPackage.replaceAll",
  "AndroidImageAdjustmentPackage.kt",
  "AndroidImageAdjustmentModule.kt",
  "class AndroidImageAdjustmentPackage : ReactPackage",
  "class AndroidImageAdjustmentModule",
  'getName(): String = "AndroidImageAdjustment"',
  "ColorMatrixColorFilter(createColorMatrix(input))",
  "promise.reject(\"invalid_uri\"",
  "promise.reject(\"decode_failed\"",
  "add(AndroidImageAdjustmentPackage())",
  "image.AndroidImageAdjustmentPackage"
]) {
  assert.ok(
    androidReleaseManifestPlugin.includes(snippet),
    `Android prebuild plugin should recreate AndroidImageAdjustment native module during prebuild: ${snippet}`
  );
}

console.log("ok - AndroidImageAdjustment native module is recreated by Expo prebuild plugin");
