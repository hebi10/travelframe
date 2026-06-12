import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appThemeSource = readFileSync("constants/app-theme.ts", "utf8");
const settingsStylesSource = readFileSync("features/settings/settings-screen.styles.ts", "utf8");
const accountStylesSource = readFileSync("features/account/account-screen.styles.ts", "utf8");
const actionRowSource = readFileSync("components/action-row.tsx", "utf8");
const screenShellSource = readFileSync("components/screen-shell.tsx", "utf8");

assert.ok(
  appThemeSource.includes('muted: "#444444"') &&
    appThemeSource.includes('faint: "#707070"') &&
    !appThemeSource.includes('muted: "#666666"') &&
    !appThemeSource.includes('faint: "#999999"'),
  "light theme secondary text colors should be darker and easier to read"
);

for (const [name, source] of [
  ["settings themed muted text", settingsStylesSource],
  ["account themed muted text", accountStylesSource]
]) {
  assert.ok(
    source.includes("mutedText: {") &&
      source.includes("color: palette.muted") &&
      source.includes('fontWeight: "700"'),
    `${name} should use a stronger weight`
  );
}

for (const [name, source] of [
  ["action row detail", actionRowSource],
  ["screen shell description", screenShellSource]
]) {
  assert.ok(
    source.includes("color: palette.muted") && source.includes('fontWeight: "700"'),
    `${name} should render secondary descriptions with a stronger weight`
  );
}

console.log("ok - muted description text stays readable");
