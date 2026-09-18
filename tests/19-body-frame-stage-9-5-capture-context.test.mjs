import assert from "node:assert/strict";
import fs from "node:fs";

const types = fs.readFileSync("types/body-capture-context.ts", "utf8");
const library = fs.readFileSync("lib/body-frame-capture-context.ts", "utf8");
const camera = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const projectDetail = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);
const photoTypes = fs.readFileSync("types/photo.ts", "utf8");

for (const token of [
  "BodyCaptureContext",
  "cameraFacing",
  "cameraRatio",
  "cameraZoomPercent",
  "cameraExposureBias",
  "cameraColorTemperature",
  "cameraColorTint",
  "cameraBrightness",
  "cameraContrast",
  "cameraSaturation",
  "enabled: boolean",
  "context: BodyCaptureContext | null"
]) {
  assert.ok(types.includes(token), `capture context types should contain ${token}`);
}

for (const forbidden of [
  "cameraTorchEnabled",
  "shutterTimer",
  "cameraTimer",
  "flashMode"
]) {
  assert.equal(
    types.includes(forbidden),
    false,
    `project capture context must not store ${forbidden}`
  );
}

for (const token of [
  "BODY_CAPTURE_CONTEXT_STORAGE_KEY",
  '"body"',
  '"frame"',
  '"capture"',
  '"context"',
  '"v1"',
  '.join(".")',
  "getBodyCaptureContextState",
  "updateBodyCaptureContextEnabled",
  "saveBodyCaptureContext",
  "createBodyCaptureContextFromAppSettings",
  "normalizeBodyCaptureContext"
]) {
  assert.ok(library.includes(token), `capture context library should contain ${token}`);
}

for (const forbidden of [
  "firebase",
  "firestore",
  "cloud-backup",
  "backupPhoto",
  "setDoc(",
  "getDoc("
]) {
  assert.equal(
    library.includes(forbidden),
    false,
    `Stage 9-5 capture context must remain Local Only: ${forbidden}`
  );
}

for (const token of [
  "getBodyCaptureContextState",
  "saveBodyCaptureContext",
  "projectCaptureContext",
  "effectiveFacing",
  "effectiveRatio",
  "effectiveZoom",
  "effectiveExposure",
  "getCurrentBodyCaptureContext",
  "captureContext: getCurrentBodyCaptureContext()",
  "projectCaptureMemoryEnabled",
  "savedPhoto.projectId"
]) {
  assert.ok(camera.includes(token), `camera capture context flow should contain ${token}`);
}

assert.ok(
  camera.includes("!projectCaptureMemoryEnabled") &&
    camera.includes("settings.cameraTorchEnabled"),
  "project capture restore should explicitly suppress torch restoration"
);

assert.equal(
  camera.includes("captureContext: {\n        cameraTorchEnabled"),
  false,
  "capture snapshot must not contain torch"
);

for (const token of [
  "getBodyCaptureContextState",
  "updateBodyCaptureContextEnabled",
  "rememberCaptureContext",
  "rememberCaptureContextDraft",
  "촬영 설정 기억",
  "라이트와 타이머는 자동으로 복원하지 않습니다."
]) {
  assert.ok(
    projectDetail.includes(token),
    `project capture-context settings should contain ${token}`
  );
}

for (const forbidden of [
  "cameraFacing?:",
  "cameraZoomPercent?:",
  "cameraExposureBias?:",
  "BodyCaptureContext"
]) {
  assert.equal(
    photoTypes.includes(forbidden),
    false,
    `PhotoItem should stay separate from project capture context: ${forbidden}`
  );
}

const qa = fs.readFileSync("docs/manual-device-qa.md", "utf8");
for (const token of [
  "촬영 설정 기억",
  "각 프로젝트 값이 독립적으로 복원",
  "라이트와 타이머"
]) {
  assert.ok(qa.includes(token), `manual QA should cover ${token}`);
}

console.log("Body Frame Stage 9-5 project capture-context contract passed.");
