import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const cameraSource = [
  fs.readFileSync("app/(tabs)/camera.tsx", "utf8"),
  fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8")
].join("\n");
const guidePositionSource = fs.readFileSync("lib/camera-guide-position.ts", "utf8");
const overlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");

const { outputText } = ts.transpileModule(guidePositionSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
});
const guidePositionModule = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

for (const [name, pattern] of [
  ["finiteOrZero", /const finiteOrZero\s*=\s*\([^)]*\)\s*=>\s*\{\s*"worklet";/],
  ["normalizeZero", /const normalizeZero\s*=\s*\([^)]*\)\s*=>\s*\{\s*"worklet";/],
  ["getGuidePositionBounds", /export function getGuidePositionBounds[^{]*\{\s*"worklet";/],
  ["clampGuidePositionOffset", /export function clampGuidePositionOffset[\s\S]*?\): CameraGuideOffset \{\s*"worklet";/],
  ["calculateGuidePositionDragOffset", /export function calculateGuidePositionDragOffset[\s\S]*?\): CameraGuideOffset \{\s*"worklet";/]
]) {
  assert.ok(
    pattern.test(guidePositionSource),
    `${name} should be callable from Reanimated gesture worklets`
  );
}

for (const snippet of [
  "guideOffsetX",
  "guideOffsetY",
  "setIsGuidePositionAdjusting",
  "startGuidePositionAdjustment",
  "finishGuidePositionAdjustment",
  "resetGuidePositionToCenter",
  "guidePositionGesture",
  "calculateGuidePositionDragOffset",
  "clampGuidePositionOffset",
  "위치·모양 조절",
  "중앙",
  "완료",
  "setGuideSettingsOpen(true)",
  "guideSettingsScroll",
  "guideSettingsContent"
]) {
  assert.ok(cameraSource.includes(snippet), `camera guide position UI missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes("GestureDetector gesture={guidePositionAdjustmentGesture}") &&
    cameraSource.includes("guidePositionGesture"),
  "guide position adjustment should use the combined drag and pinch gesture detector"
);

assert.deepEqual(
  guidePositionModule.getGuidePositionBounds({ width: 1000, height: 500 }),
  { maxX: 420, maxY: 210 },
  "guide position bounds should be based on the camera frame"
);

assert.deepEqual(
  guidePositionModule.clampGuidePositionOffset(
    { x: 999, y: -999 },
    { width: 1000, height: 500 }
  ),
  { x: 420, y: -210 },
  "guide position offset should stay inside the camera frame bounds"
);

assert.deepEqual(
  guidePositionModule.calculateGuidePositionDragOffset({
    startX: 100,
    startY: -50,
    translationX: 30.4,
    translationY: 99.6,
    frame: { width: 800, height: 600 }
  }),
  { x: 130, y: 50 },
  "guide drag offset should be derived from drag start and translation"
);

assert.deepEqual(
  guidePositionModule.calculateGuidePositionDragOffset({
    startX: Number.NaN,
    startY: 10,
    translationX: Infinity,
    translationY: -30,
    frame: { width: 0, height: 0 }
  }),
  { x: 0, y: 0 },
  "invalid guide drag values should fall back to the centered position"
);

assert.ok(
  cameraSource.includes("<ScrollView") &&
    cameraSource.includes("style={styles.guideSettingsScroll}") &&
    cameraSource.includes("contentContainerStyle={styles.guideSettingsContent}"),
  "guide settings modal should scroll so bottom actions remain visible"
);

assert.ok(
  /guideModal:\s*\{[\s\S]*?overflow:\s*"hidden"[\s\S]*?\n\s*\},/.test(cameraSource),
  "guide settings modal should clip content that exceeds the panel"
);

assert.ok(
  cameraSource.includes("!isGuidePositionAdjusting && !isGridLineControlAdjusting ? (") &&
    cameraSource.includes("{isGuidePositionAdjusting && !isGuideShapePointAdjusting ? ("),
  "camera chrome should be hidden while guide, shape-point, or grid-line adjustment is active"
);

for (const snippet of [
  "guideOffsetX: number;",
  "guideOffsetY: number;",
  "guideOffsetX: 0",
  "guideOffsetY: 0"
]) {
  assert.ok(settingsSource.includes(snippet), `app settings missing guide offset: ${snippet}`);
}

assert.ok(
  overlaySource.includes("style={[styles.overlay, offsetStyle]}"),
  "guide overlay should apply the stored position offset"
);

console.log("ok - camera guide position adjustment is wired");
