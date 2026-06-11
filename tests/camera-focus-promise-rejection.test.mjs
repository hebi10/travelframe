import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const handleCameraTapSource = cameraSource.slice(
  cameraSource.indexOf("const handleCameraTap"),
  cameraSource.indexOf("const toggleCameraFocusLock")
);
const toggleCameraFocusLockSource = cameraSource.slice(
  cameraSource.indexOf("const toggleCameraFocusLock"),
  cameraSource.indexOf("const changeCameraFacing")
);

assert.ok(
  cameraSource.includes("const handleCameraFocusError = useCallback((error: unknown) => {"),
  "camera focus errors should have a shared handler"
);
assert.ok(
  cameraSource.includes("const runCameraFocusAction = useCallback("),
  "camera focus calls should go through a safe wrapper"
);
assert.ok(
  cameraSource.includes("try {") &&
    cameraSource.includes("result.catch(handleCameraFocusError);") &&
    cameraSource.includes("handleCameraFocusError(error);"),
  "camera focus wrapper should catch both sync native throws and rejected promises"
);
assert.ok(
  cameraSource.includes('getUserFacingErrorMessage(error, "카메라 초점을 맞추지 못했습니다.")'),
  "camera focus errors should be converted to a user-facing message"
);
assert.ok(
  handleCameraTapSource.includes("runCameraFocusAction(() =>") &&
    handleCameraTapSource.includes("cameraRef.current?.focusTo(tap,"),
  "tap focus should use the safe native focus wrapper"
);
assert.equal(
  (toggleCameraFocusLockSource.match(/runCameraFocusAction\(\(\) =>/g) ?? []).length,
  2,
  "focus lock and focus reset should use the safe native focus wrapper"
);

console.log("ok - camera focus native promise rejections are handled");
