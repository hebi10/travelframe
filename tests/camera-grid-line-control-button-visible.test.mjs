import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

const sizeSectionStart = cameraSource.indexOf("<GuideSizeSlider");
const strokeSectionStart = cameraSource.indexOf("GUIDE_STROKE_WIDTH_OPTIONS", sizeSectionStart);
const sizeToStrokeSource = cameraSource.slice(sizeSectionStart, strokeSectionStart);

assert.ok(
  sizeToStrokeSource.includes('{guide === "grid" ? (') &&
    sizeToStrokeSource.includes("startGridLineControl") &&
    sizeToStrokeSource.includes("선 위치 조절"),
  "3-split line control button should be visible directly below size controls"
);

assert.ok(
  cameraSource.includes("GestureDetector gesture={gridLineControlGesture}") &&
    cameraSource.includes("updateGridGuideLineFromPoint"),
  "3-split line control should still drag individual grid lines"
);

console.log("ok - 3-split line control button stays visible near size controls");
