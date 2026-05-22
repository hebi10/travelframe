import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

for (const snippet of [
  "resetCurrentGuideAdjustment",
  "resetGuideSizeToDefault",
  "defaultGuideShapePoints[guide]",
  "resetGridLineControlToDefault(defaultGuideSize)",
  "초기화"
]) {
  assert.ok(cameraSource.includes(snippet), `camera guide reset missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes("setGuideOffsetX(0)") &&
    cameraSource.includes("setGuideOffsetY(0)") &&
    cameraSource.includes("setGuideSizeInput(String(defaultGuideSize))"),
  "guide reset should restore position and size state"
);

const actionGroupStart = cameraSource.indexOf("guidePositionActionGroup");
const actionGroupSource = cameraSource.slice(actionGroupStart, actionGroupStart + 1800);

assert.ok(
  actionGroupSource.includes("resetGuidePositionToCenter") &&
    actionGroupSource.includes("resetCurrentGuideAdjustment") &&
    actionGroupSource.includes("finishGuidePositionAdjustment"),
  "guide adjustment actions should include center, reset, and done controls"
);

console.log("ok - camera guide adjustment has a reset action for every guide");
