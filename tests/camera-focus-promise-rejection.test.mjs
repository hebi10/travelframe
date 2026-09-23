import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
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
    cameraSource.includes("result.catch(handleError);") &&
    cameraSource.includes("handleCameraFocusError(error);") &&
    cameraSource.includes("options?.onError?.();"),
  "camera focus wrapper should catch both sync native throws and rejected promises with optional rollback"
);
assert.ok(
  cameraSource.includes('getUserFacingErrorMessage(error, "카메라 초점을 맞추지 못했습니다.")'),
  "camera focus errors should be converted to a user-facing message"
);
assert.ok(
  cameraSource.includes("const cameraFocusActionTokenRef = useRef(0);") &&
    cameraSource.includes("const actionToken = ++cameraFocusActionTokenRef.current;") &&
    cameraSource.includes("if (actionToken !== cameraFocusActionTokenRef.current)") &&
    cameraSource.includes("return;"),
  "a newer focus action should supersede an older focus promise without showing a false cancellation error"
);
assert.ok(
  handleCameraTapSource.includes("!cameraNativeControlsReady"),
  "tap focus should only start after native camera controls are ready"
);
assert.ok(
  toggleCameraFocusLockSource.includes("!cameraNativeControlsReady"),
  "focus lock should only start after native camera controls are ready"
);
assert.ok(
  cameraSource.includes("cameraFocusActionTokenRef.current += 1;") &&
    cameraSource.includes("setIsCameraScreenFocused(false);"),
  "camera blur or session changes should invalidate pending focus promises"
);

assert.ok(
  handleCameraTapSource.includes("runCameraFocusAction(() =>") &&
    handleCameraTapSource.includes("cameraRef.current?.focusTo(tap,"),
  "tap focus should use the safe native focus wrapper"
);
assert.equal(
  (toggleCameraFocusLockSource.match(/runCameraFocusAction\(/g) ?? []).length,
  2,
  "focus lock and focus reset should use the safe native focus wrapper"
);
assert.ok(
  toggleCameraFocusLockSource.includes("options") === false &&
    toggleCameraFocusLockSource.includes("onError: () => {") &&
    toggleCameraFocusLockSource.includes("cameraFocusLockedRef.current = false;") &&
    toggleCameraFocusLockSource.includes("setCameraFocusLocked(false);"),
  "failed focus lock should roll UI state back to unlocked"
);

console.log("ok - camera focus promise rejections ignore superseded tap-to-lock cancellations");
