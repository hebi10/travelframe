import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

assert.ok(
  cameraSource.includes("const isLineGuideActive = guideVisible;"),
  "camera tools should mark the line guide active when the guide is visible"
);

assert.ok(
  cameraSource.includes("isLineGuideActive && styles.cameraToolButtonActive"),
  "line guide tool should use the active style while the guide is visible"
);

assert.ok(
  cameraSource.includes("<Text selectable={false} style={styles.cameraToolText}>라인</Text>"),
  "line guide tool should keep a visible line label"
);

console.log("ok - camera line guide tool reflects visible guide state");
