import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/edit.tsx", "utf8");
const guidePanelStart = source.indexOf("{guidePanelOpen ? (");
const guidePanelEnd = source.indexOf("<View style={styles.toolRow}>", guidePanelStart);

assert.ok(guidePanelStart >= 0, "edit guide panel should exist");
assert.ok(guidePanelEnd > guidePanelStart, "edit guide panel should render before tool buttons");

const guidePanel = source.slice(guidePanelStart, guidePanelEnd);

for (const snippet of [
  "EditGuideSizeSlider",
  "previewGuideSize",
  "commitGuideSize",
  "Gesture.Pan()",
  "const clampEditGuideSize = (value: number) => {\n  \"worklet\";",
  "const getGuideSizeFromTrackX = (trackX: number, trackWidth: number) => {\n  \"worklet\";",
  "dragStartThumbX.value + event.translationX",
  "GestureDetector gesture={sliderGesture}",
  "runOnJS(onChange)",
  "runOnJS(onCommit)"
]) {
  assert.ok(source.includes(snippet), `edit guide size drag control missing: ${snippet}`);
}

assert.ok(
  guidePanel.includes("<EditGuideSizeSlider"),
  "photo edit guide panel should render the drag size slider"
);

for (const forbidden of [
  "onResponderMove",
  "onResponderRelease",
  "event.nativeEvent.locationX"
]) {
  assert.ok(!source.includes(forbidden), `edit guide size slider should not use unstable responder coordinates: ${forbidden}`);
}

console.log("ok - edit guide size can be adjusted by dragging");
