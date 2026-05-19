import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

for (const snippet of [
  "saveCapturedPhoto({",
  "ratioLabel: cameraRatio",
  "setRecentPhoto(savedPhoto)",
  "backupPhotoIfEnabled({",
  "recordBackupFailure({",
  "deleteLocalFile(photo.uri)"
]) {
  assert.ok(source.includes(snippet), `camera direct save flow missing: ${snippet}`);
}

for (const forbidden of [
  "createCaptureDraft",
  "base64: true",
  "base64: photo.base64",
  'pathname: "/capture-preview"',
  "uri: draftUri",
  "applyRatioCrop: false",
  "selectCameraPictureSize",
  "getAvailablePictureSizesAsync",
  "pictureSize={pictureSize}"
]) {
  assert.ok(!source.includes(forbidden), `camera should save directly without preview route: ${forbidden}`);
}

console.log("ok - camera captures save directly into the app photo library");
