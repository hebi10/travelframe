import assert from "node:assert/strict";
import fs from "node:fs";

const overlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");

for (const snippet of [
  "styles.crossFrame",
  "renderCrossGuideLines",
  'guide === "cross"',
  "{ width: guideWidth }",
  "aspectRatio: 1"
]) {
  assert.ok(overlaySource.includes(snippet), `cross guide equal length missing: ${snippet}`);
}

assert.ok(
  !overlaySource.includes("styles.crossVertical,\n              verticalLineLengthStyle"),
  "cross guide should not size the vertical arm from the full 9:16 frame height"
);

console.log("ok - camera cross guide arms stay equal length in portrait ratios");
