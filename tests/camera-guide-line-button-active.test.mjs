import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

assert.ok(
  cameraSource.includes("const isLineGuideActive = guideVisible;"),
  "camera guide quick controls should mark the line guide active when the line guide is visible"
);

assert.ok(
  cameraSource.includes("isLineGuideActive && styles.quickPillButtonActive"),
  "line guide quick button should use the active pill style while the line guide is visible"
);

assert.ok(
  cameraSource.includes("isLineGuideActive && styles.quickPillTextActive"),
  "line guide quick button text should use the active text style while the line guide is visible"
);

console.log("ok - camera line guide quick button reflects visible guide state");
