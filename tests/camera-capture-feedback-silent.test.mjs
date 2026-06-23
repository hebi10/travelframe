import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

const capturePhotoStart = source.indexOf("  const capturePhoto = async () => {");
assert.notEqual(capturePhotoStart, -1, "camera capture function should exist");

const takePhotoStart = source.indexOf("  const takePhoto = async () => {", capturePhotoStart);
assert.notEqual(takePhotoStart, -1, "camera takePhoto function should follow capturePhoto");

const capturePhotoSource = source.slice(capturePhotoStart, takePhotoStart);

assert.ok(
  !capturePhotoSource.includes("await triggerFeedback();"),
  "camera capture should not trigger haptic feedback immediately before taking a photo"
);

assert.ok(
  capturePhotoSource.includes('enableShutterSound: cameraShutterSoundMode === "sound"'),
  "camera capture should stay silent by default while honoring the silent setting"
);

console.log("ok - camera capture stays silent by default");
