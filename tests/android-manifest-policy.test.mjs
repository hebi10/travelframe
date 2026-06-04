import assert from "node:assert/strict";
import fs from "node:fs";

const appConfig = JSON.parse(fs.readFileSync("app.json", "utf8"));
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
  mainManifest.includes("android.permission.SYSTEM_ALERT_WINDOW"),
  false,
  "release manifest should not request SYSTEM_ALERT_WINDOW"
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

console.log("ok - Android release manifest avoids risky backup and overlay settings");
