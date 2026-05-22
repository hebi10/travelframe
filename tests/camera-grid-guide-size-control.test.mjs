import assert from "node:assert/strict";
import fs from "node:fs";

const guideOverlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

assert.ok(
  cameraSource.includes("<CameraGuideOverlay") &&
    cameraSource.includes("size={guideSize}") &&
    cameraSource.includes("<GuideSizeSlider"),
  "camera guide size fine control should continue feeding CameraGuideOverlay"
);

for (const snippet of [
  "const safeGridSize = Math.max(24, Math.min(86, size));",
  "const gridLineInset = `${(100 - safeGridSize) / 2}%` as DimensionValue;",
  "const gridLineFarInset = `${100 - (100 - safeGridSize) / 2}%` as DimensionValue;",
  "gridLinePositions?.verticalStart",
  "gridLinePositions?.verticalEnd",
  "gridLinePositions?.horizontalStart",
  "gridLinePositions?.horizontalEnd",
  "{ left: verticalStartPosition }",
  "{ left: verticalEndPosition }",
  "{ top: horizontalStartPosition }",
  "{ top: horizontalEndPosition }"
]) {
  assert.ok(guideOverlaySource.includes(snippet), `grid guide size behavior missing: ${snippet}`);
}

for (const fixedPosition of ['left: "33.333%"', 'left: "66.666%"', 'top: "33.333%"', 'top: "66.666%"']) {
  assert.ok(
    !guideOverlaySource.includes(fixedPosition),
    `grid guide should not keep fixed thirds position: ${fixedPosition}`
  );
}

console.log("ok - camera grid guide size adjusts the center spacing");
