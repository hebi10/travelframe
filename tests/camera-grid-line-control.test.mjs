import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const guideOverlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");
const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");

for (const snippet of [
  "gridGuideLinePositions",
  "setGridGuideLinePositions(settings.gridGuideLinePositions)",
  "startGridLineControl",
  "finishGridLineControl",
  "resetGridLineControlToDefault",
  "gridLineControlGesture",
  "selectedGridGuideLine",
  "getNearestGridGuideLine",
  "updateGridGuideLineFromPoint",
  "선 위치 조절"
]) {
  assert.ok(cameraSource.includes(snippet), `camera grid line control missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes("{isGridLineControlAdjusting ? (") &&
    cameraSource.includes("GestureDetector gesture={gridLineControlGesture}"),
  "grid line control mode should use a dedicated gesture detector"
);

assert.ok(
  cameraSource.includes("<CameraGuideOverlay") &&
    cameraSource.includes("gridLinePositions={gridGuideLinePositions}") &&
    cameraSource.includes("selectedGridLine={selectedGridGuideLine}"),
  "camera should pass custom grid line positions and selected line to overlay"
);

for (const snippet of [
  "gridLinePositions?: GridGuideLinePositions;",
  "selectedGridLine?: GridGuideLineKey | null;",
  "styles.gridLineSelected",
  "gridLinePositions?.verticalStart",
  "gridLinePositions?.verticalEnd",
  "gridLinePositions?.horizontalStart",
  "gridLinePositions?.horizontalEnd"
]) {
  assert.ok(guideOverlaySource.includes(snippet), `overlay grid line control missing: ${snippet}`);
}

for (const snippet of [
  "export type GridGuideLinePositions",
  "gridGuideLinePositions: GridGuideLinePositions;",
  "gridGuideLinePositions: defaultGridGuideLinePositions",
  "normalizeGridGuideLinePositions(nextSettings.gridGuideLinePositions)"
]) {
  assert.ok(appSettingsSource.includes(snippet), `app settings grid line positions missing: ${snippet}`);
}

console.log("ok - camera grid guide can control each 3-split line");
