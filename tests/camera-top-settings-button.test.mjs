import assert from "node:assert/strict";
import fs from "node:fs";

import { readCameraSource } from "./camera-test-source.mjs";

const cameraSource = readCameraSource();
const stylesSource = fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8");

for (const removedSnippet of [
  "CAMERA_NAV_ITEMS",
  "cameraMenuOpen",
  "navigationOpen",
  "openNavigationMenu",
  "navigateFromCamera",
  "페이지 이동",
  "styles.cameraDropdown",
  "styles.iconMenuLine",
  "styles.cameraInstantControlRow",
  "styles.cameraInstantControlButton"
]) {
  assert.ok(
    !cameraSource.includes(removedSnippet),
    `camera top bar should remove legacy/instant control clutter: ${removedSnippet}`
  );
}

for (const requiredSnippet of [
  "styles.cameraHeaderButton",
  "onPress={openCameraSettingsMenu}",
  'accessibilityLabel="촬영 도구 열기"',
  "openCameraToolFromSettings",
  "styles.cameraToolGrid",
  "styles.cameraToolButton",
  "openLineGuideSettings",
  "openPhotoGuideSettings",
  "openColorControls",
  "openZoomControls",
  "openLightControls",
  'accessibilityLabel="라인 가이드 설정 열기"',
  'accessibilityLabel="사진 설정 열기"',
  'accessibilityLabel="색감 설정 열기"',
  'accessibilityLabel="확대 설정 열기"',
  'accessibilityLabel="라이트 설정 열기"',
  "toggleCameraFacing",
  "setCameraSettingsOpen(true)"
]) {
  assert.ok(
    cameraSource.includes(requiredSnippet),
    `camera tools should remain reachable from the compact tool sheet: ${requiredSnippet}`
  );
}

assert.ok(
  cameraSource.includes('export type CameraControlPanel = "color" | "zoom" | "light"'),
  "camera controls should keep color, zoom and light panels"
);
assert.ok(
  cameraSource.includes('activeCameraControlPanel === "light"') &&
    cameraSource.includes('setActiveCameraControlPanel((current) => (current === "light" ? null : "light"))'),
  "light tool should continue to toggle the bottom light panel"
);
assert.ok(
  cameraSource.includes("onPress={() => setLightEnabled(false)}") &&
    cameraSource.includes("onPress={() => setLightEnabled(true)}"),
  "bottom light panel should keep explicit off and on buttons"
);

for (const requiredStyleSnippet of [
  "cameraHeaderButton",
  "width: bodyFrameDesign.minTouchSize",
  "height: bodyFrameDesign.minTouchSize",
  "cameraToolGrid",
  "minHeight: bodyFrameDesign.minTouchSize"
]) {
  assert.ok(
    stylesSource.includes(requiredStyleSnippet),
    `camera chrome should follow the Body Frame touch contract: ${requiredStyleSnippet}`
  );
}

console.log("ok - camera top bar exposes one compact tool entry");
