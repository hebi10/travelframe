import assert from "node:assert/strict";

import { readCameraSource } from "./camera-test-source.mjs";

const cameraSource = readCameraSource();
const cameraRenderSource = cameraSource.slice(
  cameraSource.indexOf("{cameraDevice ? ("),
  cameraSource.indexOf("onError={handleCameraSessionError}")
);

for (const snippet of [
  "const cameraNativeControlsReady = isCameraSessionActive && isCameraReady;",
  "export function getCameraDeviceFilter(cameraFacing: CameraPosition)",
  "return { physicalDevices: CAMERA_BACK_PHYSICAL_DEVICES };",
  "export function getPreferredCameraDevice(",
  "cameraDevices.filter((device) => device.position === \"back\" && device.hasTorch)",
  "torchDevices.find((device) => cameraDeviceHasLens(device, CAMERA_LENS_WIDE))",
  "getPreferredCameraDevice(cameraDevices, cameraFacing)",
  "const cameraLightAvailable = cameraFacing === \"back\" && Boolean(cameraDevice);",
  "const visibleTorchEnabled = cameraLightAvailable && torchEnabled;",
  "const nextEnabled = cameraLightAvailable && enabled;",
  "const handleCameraTorchError = useCallback((error: unknown) =>",
  "cameraRef.current?.controller?.setTorchMode(enabled ? \"on\" : \"off\")",
  "void result.catch(handleCameraTorchError);",
  "const cameraTorchAppliedRef = useRef(false);",
  "if (!enabled && !cameraTorchAppliedRef.current) {",
  "cameraTorchAppliedRef.current = true;",
  "const cameraNativeZoom = cameraNativeControlsReady ? cameraZoomFactor : undefined;",
  "const cameraNativeExposure = cameraNativeControlsReady ? cameraExposureBias : undefined;",
  "const runCameraFocusAction = useCallback(",
  "try {",
  "result.catch(handleCameraFocusError);",
  "handleCameraFocusError(error);",
  "disabled={!cameraLightAvailable}",
  "zoom={cameraNativeZoom}",
  "exposure={cameraNativeExposure}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera native control guard missing: ${snippet}`);
}

for (const unsafeSnippet of [
  'torchMode={torchEnabled && cameraDevice.hasTorch ? "on" : "off"}',
  "torchMode={cameraTorchMode}",
  "if (cameraDevice && !cameraDevice.hasTorch && torchEnabled)",
  "useCameraDevice(cameraFacing, cameraDeviceFilter)",
  "cameraTorchDevicePinned",
  "const nextEnabled = cameraFacing === \"back\" && enabled;",
  ".focusTo(tap, {",
  ".resetFocus().catch(handleCameraFocusError)",
  "zoom={cameraZoomFactor}",
  "exposure={cameraExposureBias}"
]) {
  assert.ok(
    !cameraRenderSource.includes(unsafeSnippet),
    `camera should not push native controls before the camera is active: ${unsafeSnippet}`
  );
}

assert.ok(
  !cameraSource.includes("setIsCameraReady(false);\n    cameraTorchAppliedRef.current = false;\n  }, [cameraDevice?.id]);"),
  "camera should not force ready=false from a device-id effect because VisionCamera owns lifecycle start/stop events"
);

console.log("ok - camera native zoom exposure and torch props are guarded until active");
