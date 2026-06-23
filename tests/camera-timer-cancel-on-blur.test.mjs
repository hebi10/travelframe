import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const focusEffectSource = cameraSource.slice(
  cameraSource.indexOf("useFocusEffect("),
  cameraSource.indexOf("useFocusEffect(", cameraSource.indexOf("useFocusEffect(") + 1)
);
const appStateEffectSource = cameraSource.slice(
  cameraSource.indexOf("AppState.addEventListener"),
  cameraSource.indexOf("const triggerFeedback")
);
const takePhotoSource = cameraSource.slice(
  cameraSource.indexOf("  const takePhoto = async () => {"),
  cameraSource.indexOf("  const returnFromPermissionScreen")
);

for (const snippet of [
  "const timedCaptureTokenRef = useRef(0);",
  "const isTimedCapturePendingRef = useRef(false);",
  "const isCameraReadyRef = useRef(false);",
  "const isCameraSessionActiveRef = useRef(false);",
  "const cancelPendingTimedCapture = useCallback(() => {",
  "timedCaptureTokenRef.current += 1;",
  "isTimedCapturePendingRef.current = false;",
  "const canCaptureWithCurrentSession = useCallback(",
  "isCameraReadyRef.current &&",
  "isCameraSessionActiveRef.current"
]) {
  assert.ok(cameraSource.includes(snippet), `camera timer cancellation guard missing: ${snippet}`);
}

assert.ok(
  focusEffectSource.includes("cancelPendingTimedCapture();"),
  "camera blur should cancel a pending timer capture"
);
assert.ok(
  appStateEffectSource.includes("cancelPendingTimedCapture();"),
  "backgrounding the app should cancel a pending timer capture"
);
assert.ok(
  takePhotoSource.includes("const captureToken = timedCaptureTokenRef.current + 1;") &&
    takePhotoSource.includes("timedCaptureTokenRef.current = captureToken;"),
  "timer capture should use a per-attempt cancellation token"
);
assert.ok(
  takePhotoSource.includes("timedCaptureTokenRef.current !== captureToken") &&
    takePhotoSource.includes("!canCaptureWithCurrentSession()"),
  "timer capture should re-check cancellation and live camera state before capture"
);
assert.ok(
  takePhotoSource.includes("return;") &&
    takePhotoSource.indexOf("return;") < takePhotoSource.lastIndexOf("await capturePhoto();"),
  "cancelled timer captures should return before calling capturePhoto"
);

console.log("ok - camera timer captures cancel on blur and app background");
