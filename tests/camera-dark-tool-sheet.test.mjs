import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const stylesSource = fs.readFileSync(
  "features/camera/camera-screen.styles.ts",
  "utf8"
);
const componentsSource = fs.readFileSync(
  "features/camera/camera-screen.components.tsx",
  "utf8"
);

for (const token of [
  "cameraSettingsHandle",
  'style={styles.cameraSettingsTitle}>촬영</Text>',
  "cameraToolIntro",
  'accessibilityLabel="사진 설정 열기"',
  '<Text selectable={false} style={styles.cameraToolText}>사진</Text>',
  'name={option.value === "back" ? "camera" : "user"}',
  'name={option.value === 0 ? "slash" : "clock"}',
  'name={option.value === "off" ? "zap-off" : "zap"}',
  "cameraSettingsOptionButton",
  "showsVerticalScrollIndicator={false}",
  "<CameraSettingToggleRow\r\n                    dark",
  "<CameraShutterSoundChoice\r\n                    dark"
]) {
  assert.ok(cameraSource.includes(token), `dark camera tool sheet missing: ${token}`);
}

for (const token of [
  'backgroundColor: "#101012"',
  "bodyFrameDarkColors",
  "cameraSettingsCloseButton",
  "cameraSettingsSectionTitle",
  "cameraSettingsSectionDetail",
  "cameraSettingsOptionButtonActive",
  'backgroundColor: "#18181B"',
  "minHeight: 96"
]) {
  assert.ok(stylesSource.includes(token), `dark camera tool styles missing: ${token}`);
}

assert.ok(
  componentsSource.includes("dark?: boolean") &&
    componentsSource.includes("cameraSettingsToggleRow") &&
    componentsSource.includes("cameraSettingsShutterPanel"),
  "camera setting rows and shutter sound controls should support the dark sheet"
);

assert.equal(
  cameraSource.includes('accessibilityLabel="기준 사진 설정 열기"'),
  false,
  "the camera tool entry should be labeled simply as 사진"
);

console.log("ok - camera tool sheet follows the dark Body Frame design");
