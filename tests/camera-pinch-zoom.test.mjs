import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

for (const snippet of [
  "cameraPinchStartZoomPercent",
  "cameraPinchZoomGesture",
  "Gesture.Pinch()",
  "!referenceUri",
  "cameraPreviewGesture",
  "Gesture.Simultaneous(cameraSwipeGesture, cameraPinchZoomGesture, cameraTapFocusGesture)",
  "gesture={cameraPreviewGesture}"
]) {
  assert.ok(sourceIncludes(cameraSource, snippet), `camera pinch zoom missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes("runOnJS(applyZoomPercent)(nextZoomPercent)"),
  "camera pinch gesture should reuse the same clamped zoom state as the slider"
);

function sourceIncludes(source, snippet) {
  return source.includes(snippet);
}

console.log("ok - camera preview supports pinch zoom only without a reference image");
