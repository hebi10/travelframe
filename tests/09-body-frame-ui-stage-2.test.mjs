import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const cameraStyles = fs.readFileSync(
  "features/camera/camera-screen.styles.ts",
  "utf8"
);
const bodyFrameCameraSource = fs.readFileSync(
  "features/camera/BodyFrameCameraScreen.tsx",
  "utf8"
);

assert.equal(
  cameraSource.includes("styles.cameraInstantControlRow"),
  false,
  "Body Frame camera should not keep six instant controls in the top bar"
);
assert.ok(
  cameraSource.includes('accessibilityLabel="촬영 도구 열기"') &&
    cameraSource.includes("styles.cameraHeaderButton"),
  "camera top bar should expose one compact tools entry"
);
assert.ok(
  cameraSource.includes("styles.cameraToolGrid") &&
    cameraSource.includes("openCameraToolFromSettings"),
  "secondary camera tools should move into the camera settings sheet"
);

for (const tool of [
  "openLineGuideSettings",
  "openPhotoGuideSettings",
  "openColorControls",
  "openZoomControls",
  "openLightControls",
  "toggleCameraFacing"
]) {
  assert.ok(
    cameraSource.includes(tool),
    `camera tool sheet should preserve ${tool}`
  );
}

assert.ok(
  cameraSource.includes(
    "referenceUri || bodyFrameCameraSession.automaticReferenceUri"
  ),
  "automatic Body Frame reference photos should participate in overlay controls"
);
assert.ok(
  cameraSource.includes("overlaySetupActive && hasReferenceOverlay"),
  "automatic reference photos should open the overlay setup panel"
);
assert.ok(
  cameraSource.includes("styles.overlayQuickButton") &&
    cameraSource.includes(">투명도</Text>"),
  "bottom capture row should expose reference opacity instead of camera flip"
);
assert.equal(
  cameraSource.includes("styles.cameraFlipButton"),
  false,
  "camera facing toggle should move out of the primary bottom capture row"
);
assert.ok(
  cameraStyles.includes("width: bodyFrameDesign.minTouchSize") &&
    cameraStyles.includes("height: bodyFrameDesign.minTouchSize"),
  "top camera controls should respect the 44px shared touch target"
);
assert.ok(
  bodyFrameCameraSource.includes("insets.top + 64"),
  "project switcher should move up after top-bar simplification"
);

console.log("Body Frame UI Stage 2 camera contract passed.");
