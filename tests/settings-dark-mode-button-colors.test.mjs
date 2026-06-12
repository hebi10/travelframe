import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appAppearanceSource = readFileSync("lib/app-appearance.ts", "utf8");
const settingsStylesSource = readFileSync("features/settings/settings-screen.styles.ts", "utf8");
const settingsSource = readFileSync("app/(tabs)/settings.tsx", "utf8");

for (const snippet of [
  'background: "#000000"',
  'chrome: "#000000"',
  'inverse: "#000000"'
]) {
  assert.ok(appAppearanceSource.includes(snippet), `dark palette background should be black: ${snippet}`);
}

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

console.log("ok - settings dark mode buttons use dark backgrounds and light text");
