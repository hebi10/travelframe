import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appThemeSource = readFileSync("constants/app-theme.ts", "utf8");
const appAppearanceSource = readFileSync("lib/app-appearance.ts", "utf8");
const settingsStylesSource = readFileSync("features/settings/settings-screen.styles.ts", "utf8");
const settingsSource = readFileSync("features/settings/SettingsScreen.tsx", "utf8");

for (const snippet of [
  'background: "#0B0B0C"',
  'chrome: "#0B0B0C"',
  'inverse: "#111111"'
]) {
  assert.ok(
    appThemeSource.includes(snippet),
    `Body Frame dark palette token missing: ${snippet}`
  );
}

assert.ok(
  appAppearanceSource.includes("...bodyFrameDarkColors"),
  "app appearance should source the dark palette from Body Frame theme tokens"
);

for (const snippet of [
  "activeFill: {",
  "backgroundColor: isDark ? palette.surfaceStrong : palette.text",
  "inverseText: {",
  "color: isDark ? palette.text : palette.inverse",
  "secondaryButton: {",
  "backgroundColor: isDark ? palette.surface : palette.background"
]) {
  assert.ok(settingsStylesSource.includes(snippet), `settings dark button style missing: ${snippet}`);
}

assert.ok(
  !settingsStylesSource.includes("backgroundColor: isDark ? palette.ink : palette.text"),
  "settings dark active buttons should not use the bright ink color as background"
);

assert.ok(
  settingsSource.includes("style={[styles.guidePopupButton, themed.activeFill]}") &&
    settingsSource.includes("style={[styles.guidePopupButtonText, themed.inverseText]}"),
  "settings usage guide button should use themed active button colors"
);

console.log("ok - settings dark mode uses the approved Body Frame palette");
