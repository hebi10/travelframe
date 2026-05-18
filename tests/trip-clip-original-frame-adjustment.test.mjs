import assert from "node:assert/strict";
import fs from "node:fs";

const previewSource = fs.readFileSync("components/trip-clip-preview-player.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/trip-clip.tsx", "utf8");

for (const snippet of [
  "frameAspectRatio",
  "getOriginalImageFrameStyle",
  "contentFit=\"fill\"",
  "styles.previewImageMotionLayer",
  "alignItems: \"center\"",
  "justifyContent: \"center\""
]) {
  assert.ok(previewSource.includes(snippet), `preview original-frame adjustment missing: ${snippet}`);
}

assert.ok(
  !previewSource.includes("<Reanimated.View style={[styles.previewGestureLayer, adjustStyle]}"),
  "preview adjustment should not transform both the gesture layer and image layer"
);

for (const snippet of [
  "frameAspectRatio={ratioAspect[ratio]}",
  "frameAspectRatio: number;",
  "getOriginalImageFrameStyle",
  "contentFit=\"fill\""
]) {
  assert.ok(tripClipSource.includes(snippet), `recording original-frame adjustment missing: ${snippet}`);
}

console.log("ok - trip clip adjustment moves the original image frame");
