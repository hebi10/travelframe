import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/edit.tsx", "utf8");

for (const snippet of [
  "isGuidePositionAdjusting",
  "guidePositionGesture",
  "calculateGuidePositionDragOffset",
  "guideDragStartX",
  "guideDragStartY",
  "syncGuideOffsetFromGesture",
  "finishGuidePositionAdjustment",
  "startGuidePositionAdjustment",
  "stopGuidePositionAdjustment",
  "guideOffsetXValue",
  "guideOffsetYValue",
  "guideOffsetX: clampedOffset.x",
  "guideOffsetY: clampedOffset.y",
  "라인 이동",
  "이동 완료",
  "GestureDetector gesture={guidePositionGesture}"
]) {
  assert.ok(source.includes(snippet), `edit image-only guide move missing: ${snippet}`);
}

assert.ok(
  source.includes("isCanvasExpanded && isGuidePositionAdjusting"),
  "guide move gesture layer should only cover the image-only canvas"
);

assert.ok(
  source.includes("setGuidePanelOpen(true)"),
  "finishing guide move should return to the settings controls"
);

console.log("ok - edit image-only view can move shared guide line");
