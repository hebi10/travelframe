import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

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
  "setLightEnabled(!torchEnabled)",
  "onPress={openCameraSettingsMenu}",
  'accessibilityLabel="라인 가이드 설정 열기"',
  'accessibilityLabel="사진 오버레이 열기"',
  'accessibilityLabel="라이트 켜기 끄기"',
  'accessibilityLabel="카메라 설정 열기"',
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

console.log("ok - camera top bar exposes instant controls directly");
