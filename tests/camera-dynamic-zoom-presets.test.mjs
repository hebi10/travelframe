import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

for (const snippet of [
  "getCameraZoomPresets",
  "getCameraSupportsUltraWideZoom",
  "CAMERA_BACK_ZOOM_PRESETS_WITH_ULTRA_WIDE",
  "CAMERA_BACK_ZOOM_PRESETS_DEFAULT",
  "CAMERA_FRONT_ZOOM_PRESETS",
  '"0.5x"',
  '"ultra-wide-angle"',
  '"wide-angle"',
  '"telephoto"',
  "CAMERA_BACK_PHYSICAL_DEVICES",
  "getPreferredCameraDevice(cameraDevices, cameraFacing)",
  "useCameraDevices()",
  "getCameraDeviceLensTypes(cameraDevice)",
  "availableCameraLenses",
  "cameraDevice",
  "cameraZoomFactor",
  "getCameraZoomFactorFromPercent",
  "getCameraZoomPresetFactor",
  "getCameraZoomPercentFromFactor",
  "cameraZoomPresets",
  "cameraZoomPresets.map",
  "setZoomPreset(preset)",
  "cameraNativeZoom",
  "zoom={cameraNativeZoom}",
  "getInitialZoom={() => cameraZoomFactor}"
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

assert.ok(
  cameraSource.includes("getCameraSupportsUltraWideZoom(cameraDevice)"),
  "back camera should expose 0.5x only when the selected device can actually accept 0.5 zoom"
);

assert.ok(
  cameraSource.includes("getCameraZoomPresets(cameraFacing, availableCameraLenses, cameraDevice)"),
  "dynamic zoom presets should consider the selected VisionCamera device zoom bounds"
);

assert.equal(
  cameraSource.includes("getCameraZoomPresets(cameraFacing, availableCameraLenses)"),
  false,
  "dynamic zoom presets should not be derived from lens names alone"
);

assert.ok(
  /hasCameraLens\(availableLenses,\s*CAMERA_LENS_ULTRA_WIDE\)[\s\S]{0,120}getCameraSupportsUltraWideZoom\(cameraDevice\)/.test(cameraSource),
  "0.5x preset should require both an ultra-wide lens and a supported 0.5 zoom factor"
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
