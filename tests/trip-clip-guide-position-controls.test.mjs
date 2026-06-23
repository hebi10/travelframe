import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = readTripClipSource();

for (const snippet of [
  "isPreviewGuideMoving",
  "previewFrameSize",
  "previewGuideOffsetXValue",
  "previewGuideOffsetYValue",
  "previewGuideDragStartX",
  "previewGuideDragStartY",
  "getClampedPreviewGuideOffset",
  "syncPreviewGuideOffsetFromGesture",
  "finishPreviewGuideMove",
  "startPreviewGuideMove",
  "stopPreviewGuideMove",
  "resetPreviewGuidePositionToCenter",
  "previewGuideMoveGesture",
  "GestureDetector gesture={previewGuideMoveGesture}",
  "styles.previewGuideMoveLayer",
  "드래그 이동하기",
  "이동 완료",
  "중앙 이동",
  "guideOffsetX: clampedOffset.x",
  "guideOffsetY: clampedOffset.y"
]) {
  assert.ok(source.includes(snippet), `trip clip guide movement missing: ${snippet}`);
}

assert.ok(
  source.includes("setPreviewAdjustEnabled(false)"),
  "guide movement should disable photo drag adjustment to avoid gesture conflicts"
);

console.log("ok - trip clip guide position controls are available");
