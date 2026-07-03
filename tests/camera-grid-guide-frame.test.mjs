import assert from "node:assert/strict";
import fs from "node:fs";

const helperSource = fs.readFileSync("features/camera/camera-screen.helpers.ts", "utf8");
const screenSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

assert.match(
  helperSource,
  /export function getConstrainedGuideControlFrame/,
  "camera helpers should expose an aspect-ratio constrained guide control frame"
);
assert.match(
  helperSource,
  /export function getGridGuideControlPoint/,
  "camera helpers should translate grid drag coordinates into the constrained guide frame"
);
assert.match(
  screenSource,
  /getGridGuideControlPoint\(\{[\s\S]*?aspectRatio: selectedCameraRatioAspect/,
  "camera grid control should use aspect-ratio adjusted drag coordinates"
);
assert.doesNotMatch(
  screenSource,
  /getNearestGridGuideLine\(\{\s*x,\s*y,\s*frame: cameraFrame,/,
  "camera grid control should not use raw camera frame coordinates for ratio-constrained previews"
);

console.log("ok - camera grid guide controls account for constrained preview frames");
