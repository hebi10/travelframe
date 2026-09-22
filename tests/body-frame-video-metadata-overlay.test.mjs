import assert from "node:assert/strict";
import fs from "node:fs";

const videoModel = fs.readFileSync("lib/body-frame-video.ts", "utf8");
const videoScreen = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "utf8"
);
const optionsSheet = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoOptionsSheet.tsx",
  "utf8"
);
const recordingCanvas = fs.readFileSync(
  "components/trip-clip-recording-canvas.tsx",
  "utf8"
);

for (const token of [
  'showDate: false',
  'showWeight: false',
  'showBodyFat: false',
  'customText: ""',
  'position: "bottom-right"',
  'String(date.getFullYear()).slice(-2)',
  'parts.join(" · ")'
]) {
  assert.ok(videoModel.includes(token), `video overlay model missing: ${token}`);
}

for (const token of [
  '"텍스트 오버레이"',
  '"날짜"',
  '"몸무게"',
  '"체지방률"',
  '"자유 텍스트"',
  '"좌측 상단"',
  '"우측 상단"',
  '"좌측 하단"',
  '"우측 하단"',
  '"예: 12주차"',
  '"예시: 26.09.22 · 72.4kg · 18.2%"'
]) {
  assert.ok(optionsSheet.includes(token), `overlay option UI missing: ${token}`);
}

for (const token of [
  "getBodyMeasurements",
  "measurementByPhotoId",
  "measurementBySequence",
  "getBodyFrameVideoOverlayText",
  'label="텍스트"',
  'setOptionKind("overlay")',
  "previewOverlayText",
  "bodyFrameOverlayText={recordingOverlayText}",
  "bodyFrameOverlayPosition={videoOptions.overlay.position}"
]) {
  assert.ok(videoScreen.includes(token), `video overlay wiring missing: ${token}`);
}

for (const token of [
  "bodyFrameOverlayText",
  "bodyFrameOverlayPosition",
  "rgba(255, 255, 255, 0.72)",
  "recordingOverlayTopLeft",
  "recordingOverlayTopRight",
  "recordingOverlayBottomLeft",
  "recordingOverlayBottomRight",
  "recordingOverlayAboveWatermark"
]) {
  assert.ok(recordingCanvas.includes(token), `recording overlay missing: ${token}`);
}

console.log("ok - optional Body Frame video metadata overlay is wired");
