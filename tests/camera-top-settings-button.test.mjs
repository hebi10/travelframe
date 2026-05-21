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
  "styles.cameraSettingsIconButton",
  "onPress={openCameraSettingsMenu}",
  'accessibilityLabel="카메라 설정 열기"',
  'name="settings"',
  "setCameraSettingsOpen(true)"
]) {
  assert.ok(
    cameraSource.includes(requiredSnippet),
    `camera top bar should open settings directly: ${requiredSnippet}`
  );
}

console.log("ok - camera top right opens settings directly");
