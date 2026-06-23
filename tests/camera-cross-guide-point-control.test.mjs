import assert from "node:assert/strict";
import fs from "node:fs";

const helpersSource = fs.readFileSync("features/camera/camera-screen.helpers.ts", "utf8");
const overlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

for (const snippet of [
  'export type GuideShapeKey = "cross" | "triangle" | "square";',
  "cross: [",
  "defaultGuideShapePoints.cross",
  "normalizeGuideShapePointList("
]) {
  assert.ok(settingsSource.includes(snippet), `cross guide point settings missing: ${snippet}`);
}

assert.ok(
  helpersSource.includes('guide === "cross"') &&
    helpersSource.includes('guide === "triangle"') &&
    helpersSource.includes('guide === "square"'),
  "cross guide should be treated as a shape guide"
);

for (const snippet of [
  'cross: [0, 1, 2, 3]',
  "renderCrossGuideLines",
  "styles.crossFrame",
  "styles.guideShapePoint",
  "showShapeControlPoints"
]) {
  assert.ok(overlaySource.includes(snippet), `cross guide point overlay missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes("isShapeGuide(guide)") &&
    cameraSource.includes("startGuideShapePointControl") &&
    cameraSource.includes("선 설정"),
  "cross guide should reuse the camera shape point control flow"
);

console.log("ok - camera cross guide endpoints can be edited");
