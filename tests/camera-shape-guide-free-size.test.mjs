import assert from "node:assert/strict";
import fs from "node:fs";

const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const overlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");
const componentSource = fs.readFileSync("features/camera/camera-screen.components.tsx", "utf8");
const helpersSource = fs.readFileSync("features/camera/camera-screen.helpers.ts", "utf8");

for (const snippet of [
  "SHAPE_GUIDE_SIZE_MIN",
  "SHAPE_GUIDE_SIZE_MAX",
  "getGuideSizeBounds",
  'guide === "triangle" || guide === "square"'
]) {
  assert.ok(settingsSource.includes(snippet), `shape size settings missing: ${snippet}`);
}

for (const snippet of [
  "guideSizeBounds",
  "getGuideSizeBounds(guide)",
  "Math.max(guideSizeBounds.min, Math.min(guideSizeBounds.max, value))",
  "min={guideSizeBounds.min}",
  "max={guideSizeBounds.max}",
  "maxLength={String(guideSizeBounds.max).length}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera shape size range missing: ${snippet}`);
}

for (const snippet of [
  "min?: number;",
  "max?: number;",
  "min={min}",
  "max={max}"
]) {
  assert.ok(componentSource.includes(snippet), `guide size slider range prop missing: ${snippet}`);
}

assert.ok(
  overlaySource.includes("const guideSizeBounds = getGuideSizeBounds(guide)") &&
    overlaySource.includes("guideSizeBounds.min") &&
    overlaySource.includes("guideSizeBounds.max"),
  "overlay should render triangle and square using their expanded size bounds"
);

assert.ok(
  helpersSource.includes("getGuideSizeBounds(guide)") &&
    helpersSource.includes("guideSizeBounds.min") &&
    helpersSource.includes("guideSizeBounds.max"),
  "shape point drag frame should use the expanded shape size bounds"
);

console.log("ok - triangle and square guides have expanded free size controls");
