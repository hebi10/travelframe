import assert from "node:assert/strict";
import fs from "node:fs";

const overlaySource = fs.readFileSync("components/app-guide-overlay.tsx", "utf8");

assert.doesNotMatch(
  overlaySource,
  /const activeVisualIndex = Math\.min\(stepIndex, guideVisualSlides\.length - 1\);/,
  "guide overlay should keep the active slide index aligned with the current step"
);
assert.match(
  overlaySource,
  /const activeVisualIndex = stepIndex;/,
  "guide overlay should use the current step as the active visual page"
);
assert.match(
  overlaySource,
  /source: guideVisualSlides\[Math\.min\(index, guideVisualSlides\.length - 1\)\]/,
  "guide overlay can still reuse the last visual asset for extra steps"
);

console.log("ok - app guide overlay keeps slide state aligned with steps");
