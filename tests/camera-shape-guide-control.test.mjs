import assert from "node:assert/strict";
import fs from "node:fs";

const constantsSource = fs.readFileSync("constants/camera-guides.ts", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const overlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");

for (const snippet of [
  '"triangle"',
  '"square"',
  'triangle: "삼각형"',
  'square: "사각형"'
]) {
  assert.ok(constantsSource.includes(snippet), `shape guide type missing: ${snippet}`);
}

for (const snippet of [
  "export type GuideShapePoint",
  "export type GuideShapePoints",
  "defaultGuideShapePoints",
  "guideShapePoints: GuideShapePoints;",
  "guideShapePoints: defaultGuideShapePoints",
  "normalizeGuideShapePoints(nextSettings.guideShapePoints)"
]) {
  assert.ok(settingsSource.includes(snippet), `shape guide settings missing: ${snippet}`);
}

for (const snippet of [
  "shapePoints?: GuideShapePoints;",
  "showShapeControlPoints?: boolean;",
  "selectedShapePointIndex?: number | null;",
  "renderShapeGuideLines",
  "guide === \"triangle\"",
  "guide === \"square\"",
  "styles.guideShapeLine",
  "styles.guideShapePoint",
  "styles.crossFrame",
  "renderCrossGuideLines"
]) {
  assert.ok(overlaySource.includes(snippet), `shape guide overlay missing: ${snippet}`);
}

for (const snippet of [
  "guideShapePoints",
  "setGuideShapePoints(settings.guideShapePoints)",
  "startGuideShapePointControl",
  "finishGuideShapePointControl",
  "guideShapePointGesture",
  "selectedGuideShapePointIndex",
  "getNearestGuideShapePoint",
  "updateGuideShapePointFromPoint",
  "shapePoints={guideShapePoints}",
  "showShapeControlPoints={isGuideShapePointAdjusting}",
  "selectedShapePointIndex={selectedGuideShapePointIndex}",
  "guideShapePoints: guideShapePointsRef.current",
  "선 설정"
]) {
  assert.ok(cameraSource.includes(snippet), `camera shape guide control missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes("{isGuideShapePointAdjusting ? (") &&
    cameraSource.includes("GestureDetector gesture={guideShapePointGesture}"),
  "shape point control should use its own drag gesture"
);

console.log("ok - camera shape guides can be added and edited by vertex");
