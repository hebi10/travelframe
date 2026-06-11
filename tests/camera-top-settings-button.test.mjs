import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const stylesSource = fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8");

for (const removedSnippet of [
  "CAMERA_NAV_ITEMS",
  "cameraMenuOpen",
  "navigationOpen",
  "openNavigationMenu",
  "navigateFromCamera",
  "페이지 이동",
  "styles.cameraDropdown",
  "styles.iconMenuLine"
]) {
  assert.ok(
    !cameraSource.includes(removedSnippet),
    `camera top bar should remove hamburger navigation flow: ${removedSnippet}`
  );
}

for (const requiredSnippet of [
  "styles.cameraInstantControlRow",
  "styles.cameraInstantControlButton",
  "openLineGuideSettings",
  "openPhotoGuideSettings",
  "openZoomControls",
  "setLightEnabled(!torchEnabled)",
  "onPress={openCameraSettingsMenu}",
  'accessibilityLabel="라인 가이드 설정 열기"',
  'accessibilityLabel="사진 오버레이 열기"',
  'accessibilityLabel="확대 설정 열기"',
  'accessibilityLabel="라이트 켜기 끄기"',
  'accessibilityLabel="카메라 설정 열기"',
  'name="zoom-in"',
  'name="settings"',
  "setCameraSettingsOpen(true)"
]) {
  assert.ok(
    cameraSource.includes(requiredSnippet),
    `camera top bar should expose instant camera controls: ${requiredSnippet}`
  );
}

assert.ok(
  !cameraSource.includes("styles.cameraSettingsIconButton"),
  "camera settings should no longer be a standalone top-right-only button"
);

const topLightButtonSource = cameraSource.slice(
  cameraSource.indexOf('accessibilityLabel="라이트 켜기 끄기"') - 280,
  cameraSource.indexOf('accessibilityLabel="카메라 설정 열기"')
);
assert.ok(
  topLightButtonSource.includes("onPress={() => setLightEnabled(!torchEnabled)}"),
  "top light button should toggle the light setting directly"
);
assert.ok(
  !topLightButtonSource.includes("disabled={!cameraLightReady}") &&
    !topLightButtonSource.includes("disabled={!cameraLightAvailable}"),
  "top light button should stay clickable even before native torch controls are ready"
);

for (const requiredStyleSnippet of [
  "left: 12",
  "right: 12",
  "gap: 8",
  "width: 38",
  "width: 40"
]) {
  assert.ok(
    stylesSource.includes(requiredStyleSnippet),
    `camera top bar should fit five instant controls on narrow Android widths: ${requiredStyleSnippet}`
  );
}

console.log("ok - camera top bar exposes instant controls directly");
