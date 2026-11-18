import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

assert.ok(
  source.includes("const CAMERA_PERMISSION_RECOVERY_TIMEOUT_MS = 3_000;"),
  "camera capture should bound permission-triggered session recovery"
);
assert.ok(
  source.includes("const waitForCameraSessionReadyForCapture = useCallback(async () =>"),
  "camera capture should wait for the native session to become ready again"
);
assert.ok(
  source.includes("await waitForCameraSessionReadyForCapture();"),
  "camera capture should resume after permission or pose-related session interruptions"
);
assert.equal(
  source.includes("await requestPhotoSavePermission();\n        if (!canCaptureWithCurrentSession()) return;"),
  false,
  "camera capture must not silently abort immediately after a media permission check"
);
const start = source.indexOf("  const capturePhoto = async () => {");
const end = source.indexOf("  const takePhoto = async () => {", start);
const code = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;

class CaptureTimeout extends Error {}
function harness({
  device = true,
  permission = async () => {},
  canCapture = () => true,
  waitForReady = null,
  timeout = false,
  projectId = null,
  loadProject = async id => ({ id, saveMode: "local_only" }),
  posePending = false
} = {}) {
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
    poseSnapshotPromiseRef: { current: posePending ? Promise.resolve() : null },
    getBodyFrameCameraSessionSnapshot: () => ({ projectId }),
    getBodyProjectById: loadProject,
    getProjectSaveTargets: ({ legacyScope }) => ({ app: true, device: legacyScope === "app_device", cloud: false }),
    setIsCapturing: (value) => { capturing = value; },
    setErrorMessage: (value) => { if (value) events.push("error"); },
    canSelectCloudSaveTarget: true,
    cameraSaveScope: device ? "app_device" : "app",
    getCameraSaveScopeTargets: (scope) => ({ app: true, device: scope === "app_device", cloud: false }),
    createCameraSaveScope: () => "app",
    requestPhotoSavePermission: async () => { events.push("permission"); await permission(); },
    waitForCameraSessionReadyForCapture: async () => {
      if (waitForReady) {
        events.push("wait-ready");
        await waitForReady();
      }
    },
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
    isDeviceAlbumPermissionError: (error) => {
      const message = error instanceof Error ? error.message : "";
      return (
        message.includes("앨범 저장 권한") ||
        message.includes("사진 접근 권한") ||
        message.includes("선택한 사진만")
      );
    },
    showDeviceAlbumPermissionPrompt: () => events.push("permission-help"),
    finishBodyFrameCameraCapture: () => events.push("release"),
    deleteLocalFile: async () => events.push("cleanup")
  };
  const capture = new Function(...Object.keys(dependencies), `${code}; return capturePhoto;`)(...Object.values(dependencies));
  return { capture, events, lock, isCapturing: () => capturing };
}

// Permission now belongs to the background save job; capture itself must not be blocked.
const first = harness({ device: true });
await first.capture();
assert.deepEqual(first.events, ["reserve", "capture", "queue"]);
assert.equal(first.lock.current, false);
assert.equal(first.isCapturing(), false);
assert.ok(!first.events.includes("permission"));

let releaseProjectLoad;
const projectLoad = new Promise(resolve => { releaseProjectLoad = resolve; });
const pendingProject = harness({
  projectId: "project-a",
  loadProject: async id => { await projectLoad; return { id, saveMode: "local_only" }; }
});
const blocked = pendingProject.capture();
await Promise.resolve();
await pendingProject.capture();
assert.deepEqual(pendingProject.events, [], "double shutter taps must not start a second capture while storage mode loads");
releaseProjectLoad();
await blocked;
assert.deepEqual(pendingProject.events, ["reserve", "capture", "queue"]);

let cameraReady = false;
const recoveredSession = harness({
  posePending: true,
  waitForReady: async () => { cameraReady = true; }
});
await recoveredSession.capture();
assert.ok(cameraReady);
assert.deepEqual(recoveredSession.events, ["wait-ready", "reserve", "capture", "queue"],
  "pose-triggered camera recovery must still precede native capture");

const unrecoveredSession = harness({
  posePending: true,
  waitForReady: async () => { throw new Error("카메라를 다시 준비하지 못했습니다."); }
});
await unrecoveredSession.capture();
assert.deepEqual(unrecoveredSession.events, ["wait-ready", "error"],
  "camera recovery failures must not enter saving queue");

const localOnly = harness({ device: false });
await localOnly.capture();
assert.deepEqual(localOnly.events, ["reserve", "capture", "queue"]);

const queueSource = source.slice(
  source.indexOf("const runSaveJob = async () =>"),
  source.indexOf("const capturePhoto = async () =>")
);
assert.ok(queueSource.indexOf("saveCapturedPhoto(captureInput, captureReservation)") <
          queueSource.indexOf("await requestPhotoSavePermission()"),
  "app photo save must precede the permission prompt for optional album copies");
assert.ok(queueSource.includes("if (!savedPhoto) throw deviceError;"),
  "an album denial after a durable app save must not delete the photo");
console.log("ok - app recording precedes optional album permission, double taps and camera recovery stay safe");
const stalled = harness({ device: false, timeout: true });
await stalled.capture();
assert.ok(stalled.events.includes("recover"), "native capture timeout must restart the camera");
assert.ok(stalled.events.includes("release"), "failed capture must release its project reservation");
assert.ok(!stalled.events.includes("queue"));
assert.equal(stalled.lock.current, false);
assert.equal(stalled.isCapturing(), false);
