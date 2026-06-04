import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

assert.ok(
  cameraSource.includes("const isLineGuideActive = guideVisible;"),
  "camera guide quick controls should mark the line guide active when the line guide is visible"
);

assert.ok(
  cameraSource.includes("isLineGuideActive && styles.cameraInstantControlButtonActive"),
  "line guide instant button should use the active style while the line guide is visible"
);

assert.ok(
  cameraSource.includes("<Text selectable={false} style={styles.cameraInstantControlText}>라인</Text>"),
  "line guide instant button should keep a visible line label"
);

console.log("ok - camera line guide instant button reflects visible guide state");
