import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const guideOverlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");

for (const snippet of [
  'guide === "grid"',
  "styles.gridOverlay",
  "...StyleSheet.absoluteFillObject",
  "styles.gridVertical",
  "styles.gridHorizontal"
]) {
  assert.ok(guideOverlaySource.includes(snippet), `fullscreen grid guide missing: ${snippet}`);
}

assert.ok(
  guideOverlaySource.includes("<View style={styles.gridOverlay}>"),
  "grid guide should fill the overlay instead of using the adjustable guide frame"
);

assert.ok(
  cameraSource.includes('guide !== "grid"') &&
    cameraSource.includes("{ translateX: guideOffsetXValue }") &&
    cameraSource.includes("{ translateY: guideOffsetYValue }"),
  "camera grid guide should not be shifted by saved guide offsets"
);

assert.ok(
  cameraSource.includes('{guide !== "grid" ? (') &&
    cameraSource.includes("applyGuideSize(option.value)") &&
    cameraSource.includes("startGuidePositionAdjustment"),
  "grid guide should not show size or position controls because it is fixed to the full camera frame"
);

assert.ok(
  !guideOverlaySource.includes("gridFrame"),
  "grid guide should not keep the old adjustable square frame style"
);

console.log("ok - camera grid guide fills the camera preview without clipping");
