import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appAppearance = readFileSync("lib/app-appearance.ts", "utf8");
const appTheme = readFileSync("constants/app-theme.ts", "utf8");
const settingsScreen = readFileSync("features/settings/SettingsScreen.tsx", "utf8");
const accountScreen = [
  readFileSync("features/account/AccountScreen.tsx", "utf8"),
  readFileSync("features/account/account-screen.styles.ts", "utf8")
].join("\n");
const tabsLayout = readFileSync("app/(tabs)/_layout.tsx", "utf8");
const screenShell = readFileSync("components/screen-shell.tsx", "utf8");
const actionRow = readFileSync("components/action-row.tsx", "utf8");
const sectionBlock = readFileSync("components/section-block.tsx", "utf8");

assert.ok(
  appAppearance.includes("subscribeAppSettings"),
  "appearance hook should subscribe to saved setting changes"
);
assert.ok(
  appAppearance.includes("let cachedAppSettings: AppSettings = defaultAppSettings") &&
    appAppearance.includes("useState<AppSettings>(cachedAppSettings)") &&
    appAppearance.includes("cachedAppSettings = storedSettings") &&
    appAppearance.includes("cachedAppSettings = nextSettings"),
  "appearance hook should reuse the last loaded settings when new screens mount"
);
assert.ok(
  appAppearance.includes("emphasisWeight"),
  "appearance hook should expose font style weight"
);
for (const darkColor of [
  'background: "#0B0B0C"',
  'chrome: "#0B0B0C"',
  'surface: "#131315"',
  'surfaceStrong: "#1A1A1D"',
  'text: "#F5F5F5"',
  'muted: "#A0A0A6"',
  'faint: "#68686E"',
  'line: "#2A2A2E"',
  'inverse: "#111111"',
  'ink: "#F5F5F5"'
]) {
  assert.ok(appTheme.includes(darkColor), `Body Frame dark palette should include ${darkColor}`);
}
assert.ok(
  appAppearance.includes("bodyFrameDarkColors"),
  "appearance hook should consume shared Body Frame dark tokens"
);
assert.ok(
  tabsLayout.includes("backgroundColor: palette.chrome"),
  "bottom tabs should use the chrome background color"
);
assert.ok(
  settingsScreen.includes("subscribeAppSettings") &&
    settingsScreen.includes("setSettings(nextSettings)"),
  "settings screen should react to global setting changes"
);
assert.ok(
  settingsScreen.includes("activeMarkFill=\"transparent\""),
  "theme mode modal should not draw a filled mode selection background"
);
assert.ok(
  accountScreen.includes("backgroundColor: isDark ? palette.surfaceStrong : palette.text") &&
    accountScreen.includes("backgroundColor: palette.surfaceStrong") &&
    accountScreen.includes("color: isDark ? palette.text : palette.inverse"),
  "account active controls should keep visible dark-mode contrast without white fills"
);
assert.ok(
  tabsLayout.includes("fontSizeScale") &&
    tabsLayout.includes("layoutScale") &&
    tabsLayout.includes("emphasisWeight") &&
    tabsLayout.includes("fontFamily"),
  "bottom tabs should apply font size, selected font family, and layout settings"
);
assert.ok(
  screenShell.includes("getTitleStyle(settings.fontStyle, fontSizeScale, fontFamily)"),
  "screen shell should apply selected font family and font size to page titles"
);
assert.ok(
  actionRow.includes("fontSizeScale") && actionRow.includes("layoutScale") && actionRow.includes("fontFamily"),
  "action rows should apply font size, selected font family, and layout settings"
);
assert.ok(
  sectionBlock.includes("fontSizeScale") && sectionBlock.includes("layoutScale") && sectionBlock.includes("fontFamily"),
  "section blocks should apply font size, selected font family, and layout settings"
);

console.log("ok - app appearance settings propagate to shared UI");
