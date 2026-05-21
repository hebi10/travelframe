import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

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

console.log("ok - camera zoom presets are derived from camera facing and available lenses");
