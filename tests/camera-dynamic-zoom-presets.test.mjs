import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

for (const snippet of [
  "getCameraZoomPresets",
  "CAMERA_BACK_ZOOM_PRESETS_WITH_ULTRA_WIDE",
  "CAMERA_BACK_ZOOM_PRESETS_DEFAULT",
  "CAMERA_FRONT_ZOOM_PRESETS",
  '"0.5x"',
  '"ultra-wide-angle"',
  '"wide-angle"',
  '"telephoto"',
  "CAMERA_BACK_PHYSICAL_DEVICES",
  "getCameraDeviceFilter(cameraFacing)",
  "useCameraDevice(cameraFacing, cameraDeviceFilter)",
  "getCameraDeviceLensTypes(cameraDevice)",
  "availableCameraLenses",
  "cameraZoomFactor",
  "getCameraZoomFactorFromPercent",
  "getCameraZoomPresetFactor",
  "getCameraZoomPercentFromFactor",
  "cameraZoomPresets",
  "cameraZoomPresets.map",
  "setZoomPreset(preset)",
  "zoom={cameraZoomFactor}"
]) {
  assert.ok(cameraSource.includes(snippet), `dynamic VisionCamera zoom missing: ${snippet}`);
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

for (const removed of [
  "selectedCameraLens",
  "setSelectedCameraLens",
  "selectedLens={selectedCameraLens}",
  "onAvailableLensesChanged",
  "getAvailableLensesAsync",
  "builtInUltraWideCamera",
  "builtInWideAngleCamera"
]) {
  assert.equal(
    cameraSource.includes(removed),
    false,
    `expo-camera lens path should be removed: ${removed}`
  );
}

console.log("ok - VisionCamera zoom presets are derived from facing and physical lenses");
