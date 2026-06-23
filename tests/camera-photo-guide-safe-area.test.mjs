import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

assert.ok(
  cameraSource.includes("const controlsStyle = overlaySetupActive"),
  "camera controls should switch to a safe-area-aware style while the photo guide setup panel is open"
);

assert.ok(
  cameraSource.includes("paddingBottom: bottomSafePadding"),
  "photo guide setup controls should include bottom safe area padding"
);

assert.ok(
  cameraSource.includes("style={controlsStyle}") &&
    cameraSource.includes("onLayout={(event) => {"),
  "camera controls should render through the computed safe-area-aware style"
);

console.log("ok - camera photo guide setup panel accounts for bottom safe area");
