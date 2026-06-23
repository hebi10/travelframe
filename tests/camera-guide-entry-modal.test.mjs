import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

for (const snippet of [
  "openLineGuideSettings",
  "openPhotoGuideSettings",
  "onPress={openLineGuideSettings}",
  "onPress={openPhotoGuideSettings}",
  "라인",
  "오버레이",
  "setGuideSettingsOpen(true)",
  "reopenOverlaySetup();"
]) {
  assert.ok(cameraSource.includes(snippet), `camera instant guide entry missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes("const isCameraModalOpen = guideSettingsOpen || cameraSettingsOpen"),
  "camera controls should still be blocked by camera modals"
);

for (const removed of [
  "guideChoiceOpen",
  "setGuideChoiceOpen",
  "visible={guideChoiceOpen}",
  'activeCameraControlTab === "guide"',
  "hiddenCameraDropdownItem",
  "guideLaunchLabel",
  "hiddenGuideSettingsLabel",
  "guideSettingsValue",
  "guideOnlyLabel"
]) {
  assert.ok(!cameraSource.includes(removed), `camera guide UI should not keep hidden legacy code: ${removed}`);
}

assert.ok(
  !cameraSource.includes("사진 가이드 띄우기"),
  "photo guide should not remain as a hidden top-right menu item"
);

assert.ok(
  !cameraSource.includes("openReferenceOverlayMenu"),
  "photo guide should no longer be opened from the top-right menu"
);

assert.ok(
  cameraSource.includes("<CameraGuideOverlay") && cameraSource.includes("<PhotoReferenceOverlay"),
  "line guide and photo guide should remain independently renderable"
);

console.log("ok - camera guide entry modal routes line and photo guides");
