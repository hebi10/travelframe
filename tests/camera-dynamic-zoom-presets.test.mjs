import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const nativeCameraSource = fs.readFileSync(
  "node_modules/expo-camera/android/src/main/java/expo/modules/camera/ExpoCameraView.kt",
  "utf8"
);
const nativeModuleSource = fs.readFileSync(
  "node_modules/expo-camera/android/src/main/java/expo/modules/camera/CameraViewModule.kt",
  "utf8"
);
const patchSource = fs.readFileSync("patches/expo-camera+55.0.0.patch", "utf8");

for (const snippet of [
  "getCameraZoomPresets",
  "CAMERA_BACK_ZOOM_PRESETS_WITH_ULTRA_WIDE",
  "CAMERA_BACK_ZOOM_PRESETS_DEFAULT",
  "CAMERA_FRONT_ZOOM_PRESETS",
  '"0.5x"',
  "availableCameraLenses",
  "setAvailableCameraLenses",
  "selectedCameraLens",
  "setSelectedCameraLens",
  "setSelectedCameraLens(getCameraZoomPresetLens(preset, availableCameraLenses))",
  'setSelectedCameraLens(\n      getCameraZoomPresetLens({ label: "manual", value: nextZoom }, availableCameraLenses)\n    )',
  "cameraZoomPresets",
  "cameraZoomPresets.map",
  "setZoomPreset(preset)",
  "onAvailableLensesChanged",
  "getAvailableLensesAsync",
  "selectedLens={selectedCameraLens}"
]) {
  assert.ok(cameraSource.includes(snippet), `dynamic zoom presets missing: ${snippet}`);
}

assert.ok(
  !cameraSource.includes("const CAMERA_ZOOM_PRESETS = ["),
  "zoom presets should not be a fixed global list"
);

assert.ok(
  cameraSource.includes('cameraFacing === "front"'),
  "front camera should use a reduced zoom preset set"
);

assert.ok(
  cameraSource.includes("hasCameraLens(availableLenses, CAMERA_LENS_ULTRA_WIDE)"),
  "back camera should expose 0.5x only when an ultra-wide lens is available"
);

for (const snippet of [
  "var selectedLens: String? = null",
  "fun getAvailableLenses(): List<String>",
  "zoomState.minZoomRatio < 1f",
  "selectedLens == CAMERA_LENS_ULTRA_WIDE",
  "targetZoomRatio = if (usesUltraWideZoom)"
]) {
  assert.ok(nativeCameraSource.includes(snippet), `Android camera zoom native support missing: ${snippet}`);
  assert.ok(patchSource.includes(snippet), `Android camera zoom patch missing: ${snippet}`);
}

for (const snippet of [
  'Prop("selectedLens")',
  'AsyncFunction("getAvailableLenses")'
]) {
  assert.ok(nativeModuleSource.includes(snippet), `Android camera zoom module support missing: ${snippet}`);
  assert.ok(patchSource.includes(snippet), `Android camera zoom patch missing: ${snippet}`);
}

console.log("ok - camera zoom presets are derived from camera facing and available lenses");
