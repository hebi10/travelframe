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
assert.equal(
  mainManifest.includes("android.permission.SYSTEM_ALERT_WINDOW"),
  false,
  "release manifest should not request SYSTEM_ALERT_WINDOW"
);
assert.equal(
  mainManifest.includes("android.permission.MODIFY_AUDIO_SETTINGS"),
  false,
  "release manifest should not request MODIFY_AUDIO_SETTINGS"
);
assert.equal(
  mainManifest.includes('android:requestLegacyExternalStorage="true"'),
  false,
  "release manifest should not request legacy external storage"
);
assert.ok(
  mainManifest === "" || mainManifest.includes('android:allowBackup="false"'),
  "release manifest should disable OS app data backup"
);
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
  "Play Console"
]) {
  assert.ok(releasePolicyDoc.includes(snippet), `Android release policy doc missing: ${snippet}`);
}

assert.ok(
  releasePolicyDoc.includes("does not request `READ_MEDIA_VIDEO`"),
  "Android release policy should document why video read access is not requested"
);

console.log("ok - Android release manifest avoids risky backup, permissions, and overlay settings");
