import assert from "node:assert/strict";
import fs from "node:fs";

const appConfig = JSON.parse(fs.readFileSync("app.json", "utf8"));
const permissions = appConfig.expo?.android?.permissions ?? [];
const blockedPermissions = appConfig.expo?.android?.blockedPermissions ?? [];

assert.ok(permissions.includes("android.permission.CAMERA"), "Android should request camera access");
assert.ok(permissions.includes("android.permission.READ_MEDIA_IMAGES"), "Android should request image read access");
assert.ok(permissions.includes("android.permission.READ_MEDIA_VIDEO"), "Android should request video read access");
assert.ok(
  permissions.includes("android.permission.READ_MEDIA_VISUAL_USER_SELECTED"),
  "Android should support selected visual media access"
);
assert.equal(
  permissions.includes("android.permission.WRITE_EXTERNAL_STORAGE"),
  false,
  "Android should not request legacy broad external storage write access"
);
assert.ok(
  blockedPermissions.includes("android.permission.RECORD_AUDIO"),
  "Android should keep microphone recording blocked"
);

console.log("ok - Android permissions are scoped to current media features");
