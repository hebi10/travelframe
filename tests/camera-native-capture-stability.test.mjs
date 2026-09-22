import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

assert.ok(
  !source.includes("CAMERA_PHOTO_TARGET_RESOLUTION"),
  "camera capture should not force a fixed photo resolution"
);
assert.ok(
  !/targetResolution\s*:/.test(source),
  "VisionCamera photo output should negotiate a device-supported resolution"
);

const poseStart = source.indexOf("    const runAnalysis = async () => {");
const poseSnapshot = source.indexOf(
  "const snapshotRequest = cameraRef.current?.takeSnapshot()",
  poseStart
);
const poseCaptureGuard = source.lastIndexOf(
  "cameraNativeCaptureInProgressRef.current",
  poseSnapshot
);
const posePromiseAssignment = source.indexOf(
  "poseSnapshotPromiseRef.current = snapshotCompletion",
  poseStart
);

assert.ok(poseStart >= 0 && poseSnapshot > poseStart, "pose snapshot flow should exist");
assert.ok(
  poseCaptureGuard > poseStart && poseCaptureGuard < poseSnapshot,
  "pose analysis must not start a snapshot while a native photo capture is active"
);
assert.ok(
  posePromiseAssignment > poseSnapshot,
  "pose snapshot completion must be exposed to the native capture flow"
);

const captureStart = source.indexOf("  const capturePhoto = async () => {");
const captureEnd = source.indexOf("  const takePhoto = async () => {", captureStart);
const captureSource = source.slice(captureStart, captureEnd);
const waitForPose = captureSource.indexOf(
  "const pendingPoseSnapshot = poseSnapshotPromiseRef.current"
);
const awaitPose = captureSource.indexOf("await pendingPoseSnapshot", waitForPose);
const reserveCapture = captureSource.indexOf(
  "captureReservation = reserveBodyFrameCameraCapture()"
);
const nativeCapture = captureSource.indexOf("photoOutput.capturePhotoToFile");

assert.ok(waitForPose >= 0, "capture should inspect any in-flight pose snapshot");
assert.ok(awaitPose > waitForPose, "capture should wait for the pose snapshot to finish");
assert.ok(
  awaitPose < reserveCapture && reserveCapture < nativeCapture,
  "pose snapshot must finish before reserving and starting native photo capture"
);

console.log("ok - native photo capture is serialized against pose snapshots and uses negotiated resolution");
