import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

for (const snippet of [
  "guideChoiceOpen",
  "setGuideChoiceOpen",
  "openLineGuideSettings",
  "openPhotoGuideSettings",
  "visible={guideChoiceOpen}",
  'tab.id === "guide"',
  "onPress={openLineGuideSettings}",
  "onPress={openPhotoGuideSettings}",
  "가이드",
  "setGuideSettingsOpen(true)",
  "reopenOverlaySetup();"
]) {
  assert.ok(cameraSource.includes(snippet), `camera guide entry modal missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes("const isCameraModalOpen = guideChoiceOpen ||"),
  "guide choice modal should block camera controls like other camera modals"
);

for (const removed of [
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
