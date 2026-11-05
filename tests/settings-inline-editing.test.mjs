import assert from "node:assert/strict";
import fs from "node:fs";

const primarySource = fs.readFileSync(
  "features/settings/BodyFrameSettingsScreen.tsx",
  "utf8"
);
const defaultsSource = fs.readFileSync(
  "features/settings/SettingsScreen.tsx",
  "utf8"
);
const shellSource = fs.readFileSync("components/screen-shell.tsx", "utf8");
const themeSource = fs.readFileSync("constants/app-theme.ts", "utf8");

for (const token of [
  "InlineSettingKey",
  "setActiveSetting(\"overlayOpacity\")",
  "setActiveSetting(\"cameraRatio\")",
  "setActiveSetting(\"storageMode\")",
  "setActiveSetting(\"cloudBackup\")",
  "setActiveSetting(\"themeMode\")",
  "setActiveSetting(\"fontStyle\")",
  "setActiveSetting(\"fontSize\")",
  "APP_FONT_OPTIONS",
  "saveAppSettings"
]) {
  assert.ok(
    primarySource.includes(token),
    `primary settings should edit inline via ${token}`
  );
}

for (const token of [
  "useSafeAreaInsets",
  "modalSafeStyle",
  "paddingTop: Math.max(insets.top + 14, 24)",
  "paddingBottom: Math.max(insets.bottom + 14, 24)",
  "style={[styles.modalBackdrop, modalSafeStyle]}"
]) {
  assert.ok(
    primarySource.includes(token),
    `primary settings modal should preserve safe area via ${token}`
  );
}

const advancedRouteCount = (
  primarySource.match(/router\.push\("\/advanced-settings"\)/g) ?? []
).length;
assert.equal(
  advancedRouteCount,
  2,
  "only the two explicit detail rows should navigate to default settings"
);

for (const removedRow of [
  'label="화면 모드"',
  'label="폰트 스타일"',
  'label="폰트 크기"',
  'label="카메라 비율"',
  'label="저장 방식"'
]) {
  assert.equal(
    defaultsSource.includes(removedRow),
    false,
    `default settings should not duplicate primary row ${removedRow}`
  );
}

assert.ok(
  defaultsSource.includes('onBack={() => router.back()}') &&
    defaultsSource.includes('backLabel="설정"'),
  "default settings should expose a back action to the settings tab"
);

for (const token of [
  "onBack?: () => void",
  "backLabel?: string",
  'accessibilityRole="button"'
]) {
  assert.ok(
    shellSource.includes(token),
    `ScreenShell back control should contain ${token}`
  );
}

assert.ok(
  shellSource.includes("minHeight: bodyFrameDesign.minTouchSize") &&
    themeSource.includes("minTouchSize: 44"),
  "ScreenShell back control must use the shared 44dp minimum touch target"
);

console.log("ok - primary settings edit inline and default settings avoid duplicates");
