import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/edit.tsx", "utf8");

for (const removed of [
  "EditGuideSizeSlider",
  "previewGuideSize",
  "commitGuideSize",
  "guidePanelOpen",
  "GUIDE_SIZE_OPTIONS",
  "GUIDE_STROKE_WIDTH_OPTIONS",
  "GUIDE_COLOR_OPTIONS",
  'label: "가이드라인 편집"'
]) {
  assert.ok(
    !source.includes(removed),
    `photo editor should not keep dedicated guide editing controls: ${removed}`
  );
}

assert.ok(
  source.includes("guidePositionGesture") &&
    source.includes("라인 이동") &&
    source.includes("이동 완료"),
  "image-only guide position adjustment should remain available"
);

console.log("ok - dedicated guide editor controls are removed while line move remains");
