import assert from "node:assert/strict";
import fs from "node:fs";

const mainManifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const debugManifest = fs.existsSync("android/app/src/debug/AndroidManifest.xml")
  ? fs.readFileSync("android/app/src/debug/AndroidManifest.xml", "utf8")
  : "";

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
  mainManifest.includes('android:allowBackup="false"'),
  "release manifest should disable OS app data backup"
);
assert.ok(
  debugManifest.includes("android.permission.SYSTEM_ALERT_WINDOW"),
  "debug manifest may keep SYSTEM_ALERT_WINDOW for development tooling"
);

console.log("ok - Android release manifest avoids risky backup and overlay settings");
