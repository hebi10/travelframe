import assert from "node:assert/strict";
import fs from "node:fs";

const appConfig = JSON.parse(fs.readFileSync("app.json", "utf8"));
const releasePolicyDocPath = "docs/android-release-policy.md";
const releasePolicyDoc = fs.existsSync(releasePolicyDocPath)
  ? fs.readFileSync(releasePolicyDocPath, "utf8")
  : "";
const mainManifest = fs.existsSync("android/app/src/main/AndroidManifest.xml")
  ? fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8")
  : "";
const debugManifest = fs.existsSync("android/app/src/debug/AndroidManifest.xml")
  ? fs.readFileSync("android/app/src/debug/AndroidManifest.xml", "utf8")
  : "";
const androidReleaseManifestPluginPath = "plugins/with-android-release-manifest.js";
const androidReleaseManifestPlugin = fs.existsSync(androidReleaseManifestPluginPath)
  ? fs.readFileSync(androidReleaseManifestPluginPath, "utf8")
  : "";

function hasRequestedPermission(manifest, permissionName) {
  const permissionPattern = new RegExp(
    `<uses-permission\\b(?=[^>]*android:name="${permissionName.replaceAll(".", "\\.")}")[^>]*>`,
    "g"
  );
  const matches = manifest.match(permissionPattern) ?? [];
  return matches.some((entry) => !entry.includes('tools:node="remove"'));
}

assert.equal(
  appConfig.expo?.android?.allowBackup,
  false,
  "app config should disable Android OS app data backup"
);
assert.equal(
  Object.hasOwn(appConfig.expo?.android ?? {}, "requestLegacyExternalStorage"),
  false,
  "app config should not request legacy external storage"
);
assert.equal(
  Object.hasOwn(appConfig.expo?.android ?? {}, "versionCode"),
  false,
  "local Android AAB versionCode should not be split into app.json"
);
assert.equal(
  appConfig.expo?.android?.permissions?.includes("android.permission.MODIFY_AUDIO_SETTINGS"),
  false,
  "app config should not request MODIFY_AUDIO_SETTINGS unless a native audio-routing feature needs it"
);
assert.equal(
  appConfig.expo?.android?.permissions?.includes("android.permission.READ_MEDIA_VIDEO"),
  false,
  "app config should not request READ_MEDIA_VIDEO unless users import videos from their library"
);
assert.ok(
  appConfig.expo?.plugins?.includes("./plugins/with-android-release-manifest"),
  "app config should run the Android release manifest plugin during expo prebuild"
);
assert.equal(
  mainManifest.includes("android.permission.SYSTEM_ALERT_WINDOW"),
  false,
  "release manifest should not request SYSTEM_ALERT_WINDOW"
);
assert.equal(
  hasRequestedPermission(mainManifest, "android.permission.MODIFY_AUDIO_SETTINGS"),
  false,
  "release manifest should not request MODIFY_AUDIO_SETTINGS"
);
assert.equal(
  mainManifest.includes('android:requestLegacyExternalStorage="true"'),
  false,
  "release manifest should not request legacy external storage"
);
assert.ok(
  mainManifest.includes('tools:remove="android:requestLegacyExternalStorage"'),
  "release manifest should remove requestLegacyExternalStorage added by manifest merging"
);
assert.ok(
  mainManifest === "" || mainManifest.includes('android:allowBackup="false"'),
  "release manifest should disable OS app data backup"
);
for (const optionalFeature of [
  "android.hardware.camera",
  "android.hardware.microphone"
]) {
  assert.ok(
    mainManifest.includes(`<uses-feature android:name="${optionalFeature}" android:required="false"/>`) ||
      mainManifest.includes(`<uses-feature android:name="${optionalFeature}" android:required="false" />`),
    `release manifest should keep ${optionalFeature} optional so Play Console does not filter supported devices`
  );
}
for (const snippet of [
  "withAndroidManifest",
  "android.hardware.camera",
  "android.hardware.microphone",
  'existingFeature.$["android:required"] = "false"',
  'delete application["android:requestLegacyExternalStorage"]',
  'removeAttributes.add("android:requestLegacyExternalStorage")',
  'application["tools:remove"] = [...removeAttributes].join(",")'
]) {
  assert.ok(
    androidReleaseManifestPlugin.includes(snippet),
    `Android release manifest plugin should enforce release policy during prebuild: ${snippet}`
  );
}
assert.ok(
  debugManifest === "" || debugManifest.includes("android.permission.SYSTEM_ALERT_WINDOW"),
  "debug manifest may keep SYSTEM_ALERT_WINDOW for development tooling"
);

for (const snippet of [
  "Local AAB versionCode",
  "EAS remote appVersionSource",
  "CAMERA",
  "READ_MEDIA_IMAGES",
  "READ_MEDIA_VISUAL_USER_SELECTED",
  "AD_ID",
  "android.hardware.camera",
  "android.hardware.microphone",
  "Play Console"
]) {
  assert.ok(releasePolicyDoc.includes(snippet), `Android release policy doc missing: ${snippet}`);
}

assert.ok(
  releasePolicyDoc.includes("does not request `READ_MEDIA_VIDEO`"),
  "Android release policy should document why video read access is not requested"
);

console.log("ok - Android release manifest avoids risky backup, permissions, and overlay settings");
