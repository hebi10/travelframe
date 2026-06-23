import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

for (const snippet of [
  "AppState.addEventListener",
  "isCameraScreenFocused",
  "cameraRecoveryPending",
  "cameraSessionRestartKey",
  "isCameraSessionActive",
  "isActive={isCameraSessionActive}",
  "CAMERA_SESSION_RECOVERY_DELAY_MS",
  "setCameraSessionRestartKey((value) => value + 1)",
  "onError={handleCameraSessionError}",
  "카메라 연결이 불안정해 다시 시작합니다."
]) {
  assert.ok(cameraSource.includes(snippet), `camera session recovery missing: ${snippet}`);
}

assert.equal(
  cameraSource.includes('getUserFacingErrorMessage(error, "카메라를 시작하지 못했습니다.")'),
  false,
  "VisionCamera native fatal errors should not be rendered as raw stack traces"
);

console.log("ok - camera session errors are recovered without exposing native stacks");
