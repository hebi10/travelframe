import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const start = source.indexOf("  const capturePhoto = async () => {");
const end = source.indexOf("  const takePhoto = async () => {", start);
const code = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;

class CaptureTimeout extends Error {}
function harness({ device = true, permission = async () => {}, canCapture = () => true, timeout = false } = {}) {
  const events = [];
  const lock = { current: false };
  let capturing = false;
  const dependencies = {
    __DEV__: false,
    waitForCameraCapture: async promise => { if (timeout) throw new CaptureTimeout("timeout"); return promise; },
    CameraCaptureTimeoutError: CaptureTimeout,
    handleCameraSessionError: () => events.push("recover"),
    cameraDevice: { hasFlash: false },
    canCaptureWithCurrentSession: canCapture,
    isCapturing: false,
    cameraNativeCaptureInProgressRef: lock,
    poseSnapshotPromiseRef: { current: null },
    setIsCapturing: (value) => { capturing = value; },
    setErrorMessage: (value) => { if (value) events.push("error"); },
    canSelectCloudSaveTarget: true,
    cameraSaveScope: device ? "app_device" : "app",
    getCameraSaveScopeTargets: (scope) => ({ app: true, device: scope === "app_device", cloud: false }),
    createCameraSaveScope: () => "app",
    requestPhotoSavePermission: async () => { events.push("permission"); await permission(); },
    reserveBodyFrameCameraCapture: () => { events.push("reserve"); return { reservationId: "1" }; },
    photoOutput: { capturePhotoToFile: async () => { events.push("capture"); return { filePath: "/photo.jpg" }; } },
    flashMode: "off",
    cameraShutterSoundMode: "silent",
    cameraRatio: "9:16",
    getCameraColorAdjustmentInput: () => ({}),
    planEntitlements: {},
    queueCapturedPhotoSave: () => events.push("queue"),
    user: null,
    subscription: null,
    getCurrentBodyCaptureContext: () => ({}),
    getUserFacingErrorMessage: (error) => error.message,
    isDeviceAlbumPermissionError: () => true,
    showDeviceAlbumPermissionPrompt: () => events.push("permission-help"),
    finishBodyFrameCameraCapture: () => events.push("release"),
    deleteLocalFile: async () => events.push("cleanup")
  };
  const capture = new Function(...Object.keys(dependencies), `${code}; return capturePhoto;`)(...Object.values(dependencies));
  return { capture, events, lock, isCapturing: () => capturing };
}

let resolvePermission;
const first = harness({ permission: () => new Promise((resolve) => { resolvePermission = resolve; }) });
const pending = first.capture();
await Promise.resolve();
assert.deepEqual(first.events, ["permission"], "permission must precede reservation, capture and the saving queue");
await first.capture();
assert.deepEqual(first.events, ["permission"], "double tapping must not open another permission request");
resolvePermission();
await pending;
assert.deepEqual(first.events, ["permission", "reserve", "capture", "queue"]);
assert.equal(first.lock.current, false);
assert.equal(first.isCapturing(), false);

const denied = harness({ permission: async () => { throw new Error("핸드폰 앨범 저장 권한이 필요합니다."); } });
await denied.capture();
assert.deepEqual(denied.events, ["permission", "permission-help"]);
assert.equal(denied.lock.current, false);
assert.equal(denied.isCapturing(), false);

let cameraActive = true;
const leftScreen = harness({
  permission: async () => { cameraActive = false; },
  canCapture: () => cameraActive
});
await leftScreen.capture();
assert.deepEqual(leftScreen.events, ["permission"], "leaving the camera while requesting permission must not capture");
assert.equal(leftScreen.isCapturing(), false);
assert.equal(leftScreen.lock.current, false);

const localOnly = harness({ device: false });
await localOnly.capture();
assert.deepEqual(localOnly.events, ["reserve", "capture", "queue"]);
console.log("ok - photo permission is resolved before capture and denied requests never enter the saving queue");
const stalled = harness({ device: false, timeout: true });
await stalled.capture();
assert.ok(stalled.events.includes("recover"), "native capture timeout must restart the camera");
assert.ok(stalled.events.includes("release"), "failed capture must release its project reservation");
assert.ok(!stalled.events.includes("queue"));
assert.equal(stalled.lock.current, false);
assert.equal(stalled.isCapturing(), false);
