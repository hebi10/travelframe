import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const importTsModule = async (filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const tempPath = path.join(
    os.tmpdir(),
    `body-frame-stage5-${path.basename(filePath).replace(/\W+/g, "-")}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`
  );
  fs.writeFileSync(tempPath, output);
  return import(pathToFileURL(tempPath).href);
};

const limits = await importTsModule("lib/body-frame-plan-limits.ts");

assert.deepEqual(
  limits.getBodyFrameCaptureLimitState({
    photoCount: 99,
    maxProgressPhotos: 100
  }),
  {
    allowed: true,
    limit: 100,
    remaining: 1,
    reached: false
  }
);
assert.deepEqual(
  limits.getBodyFrameCaptureLimitState({
    photoCount: 100,
    maxProgressPhotos: 100
  }),
  {
    allowed: false,
    limit: 100,
    remaining: 0,
    reached: true
  }
);
assert.equal(
  limits.getBodyFrameCaptureLimitState({
    photoCount: 364,
    maxProgressPhotos: 365
  }).allowed,
  true
);
assert.equal(
  limits.getBodyFrameCaptureLimitState({
    photoCount: 365,
    maxProgressPhotos: 365
  }).allowed,
  false
);
assert.deepEqual(
  limits.getBodyFrameCaptureLimitState({
    photoCount: 9999,
    maxProgressPhotos: null
  }),
  {
    allowed: true,
    limit: null,
    remaining: null,
    reached: false
  }
);

assert.equal(
  limits.getBodyFrameVideoLimitState({
    durationSeconds: 10,
    maxProgressVideoSeconds: 10
  }).allowed,
  true
);
assert.equal(
  limits.getBodyFrameVideoLimitState({
    durationSeconds: 10.1,
    maxProgressVideoSeconds: 10
  }).allowed,
  false
);
assert.equal(
  limits.getBodyFrameVideoLimitState({
    durationSeconds: 36.5,
    maxProgressVideoSeconds: 36.5
  }).allowed,
  true
);
assert.equal(
  limits.getBodyFrameVideoLimitState({
    durationSeconds: 36.6,
    maxProgressVideoSeconds: 36.5
  }).allowed,
  false
);
assert.equal(
  limits.getBodyFrameVideoLimitState({
    durationSeconds: 999,
    maxProgressVideoSeconds: null
  }).allowed,
  true
);

assert.equal(
  limits.isBodyFrameProjectTargetAllowed({
    targetPhotoCount: 100,
    maxProgressPhotos: 100
  }),
  true
);
assert.equal(
  limits.isBodyFrameProjectTargetAllowed({
    targetPhotoCount: 365,
    maxProgressPhotos: 100
  }),
  false
);
assert.equal(
  limits.isBodyFrameProjectTargetAllowed({
    targetPhotoCount: 1000,
    maxProgressPhotos: null
  }),
  true
);

assert.equal(limits.getBodyFrameUpgradePlan("guest"), "pro");
assert.equal(limits.getBodyFrameUpgradePlan("free"), "pro");
assert.equal(limits.getBodyFrameUpgradePlan("ad_remove"), "pro");
assert.equal(limits.getBodyFrameUpgradePlan("pro"), "expert");
assert.equal(limits.getBodyFrameUpgradePlan("expert"), null);
assert.equal(limits.getBodyFrameUpgradeLabel("free"), "Pro");
assert.equal(limits.getBodyFrameUpgradeLabel("pro"), "Expert");
assert.equal(limits.getBodyFrameUpgradeLabel("expert"), null);

const cameraSession = await importTsModule("lib/body-frame-camera-session.ts");

cameraSession.setBodyFrameCameraSession({
  projectId: "project-a",
  sequence: 100,
  projectPhotoCount: 99,
  maxProgressPhotos: 100,
  captureBlockedReason: null
});
const reserved99 = cameraSession.reserveBodyFrameCameraCapture();
assert.equal(reserved99?.projectId, "project-a");
assert.equal(cameraSession.getBodyFrameCameraSessionSnapshot().pendingSaveCount, 1);
assert.equal(
  cameraSession.isBodyFrameCameraCaptureBlocked(),
  true,
  "a pending save that fills the last slot must block another native capture"
);
assert.throws(
  () => cameraSession.reserveBodyFrameCameraCapture(),
  /프로젝트 사진 한도/
);
cameraSession.finishBodyFrameCameraCapture({
  projectId: "project-a",
  sequence: 100,
  success: false
});
assert.equal(cameraSession.getBodyFrameCameraSessionSnapshot().projectPhotoCount, 99);
assert.equal(cameraSession.getBodyFrameCameraSessionSnapshot().pendingSaveCount, 0);

const reserved100 = cameraSession.reserveBodyFrameCameraCapture();
assert.equal(reserved100?.sequence, 101);
cameraSession.finishBodyFrameCameraCapture({
  projectId: "project-a",
  sequence: 101,
  success: true
});
assert.equal(cameraSession.getBodyFrameCameraSessionSnapshot().projectPhotoCount, 100);
assert.ok(cameraSession.getBodyFrameCameraSessionSnapshot().captureBlockedReason);
assert.throws(
  () => cameraSession.reserveBodyFrameCameraCapture(),
  /한도/
);

cameraSession.setBodyFrameCameraSession({
  projectId: "project-a",
  sequence: 3,
  projectPhotoCount: 2,
  maxProgressPhotos: null,
  captureBlockedReason: null
});
const otherProjectReservation = cameraSession.reserveBodyFrameCameraCapture({
  projectId: "project-b",
  sequence: 7
});
assert.equal(otherProjectReservation?.projectId, "project-b");
cameraSession.finishBodyFrameCameraCapture({
  projectId: "project-b",
  sequence: 7,
  success: true
});
assert.equal(
  cameraSession.getBodyFrameCameraSessionSnapshot().projectPhotoCount,
  2,
  "finishing another project must not increment the active project's count"
);

const sessionSource = fs.readFileSync("lib/body-frame-camera-session.ts", "utf8");
for (const token of [
  "projectPhotoCount",
  "maxProgressPhotos",
  "captureBlockedReason",
  "snapshot.projectPhotoCount + snapshot.pendingSaveCount",
  "throw new Error"
]) {
  assert.ok(sessionSource.includes(token), `camera session should contain ${token}`);
}

const wrapperSource = fs.readFileSync(
  "features/camera/BodyFrameCameraScreen.tsx",
  "utf8"
);
for (const token of [
  "getPlanEntitlements",
  "getBodyFrameCaptureLimitState",
  "maxProgressPhotos: planEntitlements.maxProgressPhotos",
  "projectPhotoCount: activeSummary?.photoCount ?? 0",
  "플랜 보기"
]) {
  assert.ok(wrapperSource.includes(token), `camera wrapper should contain ${token}`);
}

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
for (const token of [
  "subscribeBodyFrameCameraSession",
  "getBodyFrameCameraSessionSnapshot",
  "bodyFrameCaptureBlocked",
  "!bodyFrameCaptureBlocked"
]) {
  assert.ok(cameraSource.includes(token), `legacy camera should contain ${token}`);
}

const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
assert.ok(
  photoLibrarySource.includes("localImageLimit: undefined"),
  "reserved Body Frame saves should bypass the unrelated legacy global image cap"
);

const switcherSource = fs.readFileSync(
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "utf8"
);
for (const token of [
  "maxProgressPhotos",
  "isBodyFrameProjectTargetAllowed",
  "upgradePlanLabel",
  "onUpgrade"
]) {
  assert.ok(switcherSource.includes(token), `project switcher should contain ${token}`);
}

const videoSource = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "utf8"
);
for (const token of [
  "getBodyFrameVideoLimitState",
  "maxProgressVideoSeconds",
  "videoLimitState.allowed",
  "플랜 보기"
]) {
  assert.ok(videoSource.includes(token), `Body Frame video screen should contain ${token}`);
}

console.log("ok - Body Frame stage 5 plan limits are enforced");
