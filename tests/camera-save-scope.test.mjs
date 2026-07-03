import assert from "node:assert/strict";
import fs from "node:fs";

const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

assert.match(
  settingsSource,
  /cloud:\s*\{\s*app:\s*true,\s*device:\s*false,\s*cloud:\s*true\s*\}/,
  "cloud save scope should keep an app-library copy for backup"
);
assert.doesNotMatch(
  settingsSource,
  /if\s*\(\s*targets\.cloud\s*\)\s*\{\s*return "cloud";\s*\}/,
  "createCameraSaveScope should not create an app-less cloud-only scope"
);
assert.match(
  cameraSource,
  /cameraSaveScope:\s*"app_cloud"/,
  "album permission fallback should switch to app + cloud backup"
);

console.log("ok - camera cloud save scope keeps an app copy");
