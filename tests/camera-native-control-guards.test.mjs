import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const cameraRenderSource = cameraSource.slice(
  cameraSource.indexOf("{cameraDevice ? ("),
  cameraSource.indexOf("onError={handleCameraSessionError}")
);

for (const snippet of [
  "const cameraNativeControlsReady = isCameraSessionActive && isCameraReady;",
  "if (cameraDevice && !cameraDevice.hasTorch && torchEnabled)",
  "const cameraLightAvailable = cameraFacing === \"back\" && cameraDevice?.hasTorch === true;",
  "const visibleTorchEnabled = cameraLightAvailable && torchEnabled;",
  "const nextEnabled = cameraLightAvailable && enabled;",
  "const cameraTorchMode = cameraNativeControlsReady && cameraLightAvailable",
  "const cameraNativeZoom = cameraNativeControlsReady ? cameraZoomFactor : undefined;",
  "const cameraNativeExposure = cameraNativeControlsReady ? cameraExposureBias : undefined;",
  "torchMode={cameraTorchMode}",
  "zoom={cameraNativeZoom}",
  "exposure={cameraNativeExposure}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera native control guard missing: ${snippet}`);
}

for (const unsafeSnippet of [
  'torchMode={torchEnabled && cameraDevice.hasTorch ? "on" : "off"}',
  "const nextEnabled = cameraFacing === \"back\" && enabled;",
  "zoom={cameraZoomFactor}",
  "exposure={cameraExposureBias}"
]) {
  assert.ok(
    !cameraRenderSource.includes(unsafeSnippet),
    `camera should not push native controls before the camera is active: ${unsafeSnippet}`
  );
}

console.log("ok - camera native zoom exposure and torch props are guarded until active");
