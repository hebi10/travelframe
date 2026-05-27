import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
const tripClipExportSource = fs.readFileSync("lib/trip-clip-export.ts", "utf8");

for (const snippet of [
  'export type CameraSaveScope = "app" | "device" | "both"',
  'cameraSaveScope: "both"',
  "const cameraSaveScopes: CameraSaveScope[]",
  "cameraSaveScopes.includes(nextSettings.cameraSaveScope)"
]) {
  assert.ok(settingsSource.includes(snippet), `camera save scope setting missing: ${snippet}`);
}

for (const snippet of [
  "CAMERA_SAVE_SCOPE_OPTIONS",
  "const [cameraSaveScope, setCameraSaveScope] = useState<CameraSaveScope>(defaultAppSettings.cameraSaveScope)",
  "setCameraSaveScope(settings.cameraSaveScope)",
  "const updateCameraSaveScope = (nextScope: CameraSaveScope)",
  "void updateAppSettings({ cameraSaveScope: nextScope })",
  "저장 범위",
  'cameraSaveScope !== "device"',
  'cameraSaveScope !== "app"',
  "saveCapturedPhoto(captureInput)",
  "saveCapturedPhotoToDevice(captureInput)",
  "let deviceSaveError: unknown = null;",
  "if (!savedPhoto) throw deviceError;",
  "throw deviceError;",
  "사진은 앱 보관함에 저장되었습니다.",
  "ratioLabel: cameraRatio",
  "setRecentPhoto(savedPhoto)",
  "backupPhotoIfEnabled({",
  "recordBackupFailure({",
  "photoUri = `file://${photo.filePath}`",
  "deleteLocalFile(photoUri)"
]) {
  assert.ok(source.includes(snippet), `camera direct save flow missing: ${snippet}`);
}

const capturePhotoStart = source.indexOf("  const capturePhoto = async () => {");
const takePhotoStart = source.indexOf("  const takePhoto = async () => {", capturePhotoStart);
assert.ok(capturePhotoStart >= 0 && takePhotoStart > capturePhotoStart, "camera capture flow should exist");
const capturePhotoSource = source.slice(capturePhotoStart, takePhotoStart);
const nativeCaptureEnd = capturePhotoSource.indexOf("photoUri = `file://${photo.filePath}`");
const unlockAfterNativeCapture = capturePhotoSource.indexOf("setIsCapturing(false)", nativeCaptureEnd);
const appSaveStart = capturePhotoSource.indexOf("saveCapturedPhoto(captureInput)");
const deviceSaveStart = capturePhotoSource.indexOf("saveCapturedPhotoToDevice(captureInput)");
assert.ok(nativeCaptureEnd >= 0, "camera should derive a photo URI after native capture");
assert.ok(
  unlockAfterNativeCapture > nativeCaptureEnd,
  "camera should unlock the shutter after native capture completes"
);
assert.ok(
  unlockAfterNativeCapture > appSaveStart && unlockAfterNativeCapture > deviceSaveStart,
  "camera should keep the shutter blocked until captured photos finish saving"
);

for (const snippet of [
  "saveCapturedPhotoToDevice",
  "saveImageToLibrary(prepared.uri)",
  "prepareCapturedPhotoForStorage(input)"
]) {
  assert.ok(photoLibrarySource.includes(snippet), `camera device save helper missing: ${snippet}`);
}

for (const snippet of [
  "requestSavePermission",
  "MediaLibrary.requestPermissionsAsync",
  "if (!permission.granted)",
  "핸드폰 앨범 저장 권한이 필요합니다."
]) {
  assert.ok(tripClipExportSource.includes(snippet), `media save permission request missing: ${snippet}`);
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
