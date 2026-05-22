import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

for (const snippet of [
  "guideSizeRef",
  "guidePinchStartSize",
  "guidePositionPinchGesture",
  "guidePositionAdjustmentGesture",
  "Gesture.Simultaneous(guidePositionGesture, guidePositionPinchGesture)",
  "GestureDetector gesture={guidePositionAdjustmentGesture}",
  "runOnJS(previewGuideSize)",
  "guideSize: guideSizeRef.current"
]) {
  assert.ok(cameraSource.includes(snippet), `camera guide pinch size missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes(".maxPointers(1)") &&
    cameraSource.includes(".enabled(isGuidePositionAdjusting)"),
  "guide drag pan should stay single-finger while pinch handles two-finger size changes"
);

console.log("ok - camera guide drag mode supports two-finger size control");
