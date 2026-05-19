import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appAppearance = readFileSync("lib/app-appearance.ts", "utf8");
const settingsScreen = readFileSync("app/(tabs)/settings.tsx", "utf8");
const tabsLayout = readFileSync("app/(tabs)/_layout.tsx", "utf8");
const screenShell = readFileSync("components/screen-shell.tsx", "utf8");
const actionRow = readFileSync("components/action-row.tsx", "utf8");
const sectionBlock = readFileSync("components/section-block.tsx", "utf8");

assert.ok(
  appAppearance.includes("subscribeAppSettings"),
  "appearance hook should subscribe to saved setting changes"
);
assert.ok(
  appAppearance.includes("emphasisWeight"),
  "appearance hook should expose font style weight"
);
assert.ok(
  settingsScreen.includes("subscribeAppSettings") &&
    settingsScreen.includes("setSettings(nextSettings)"),
  "settings screen should react to global setting changes"
);
assert.ok(
  tabsLayout.includes("fontSizeScale") &&
    tabsLayout.includes("layoutScale") &&
    tabsLayout.includes("emphasisWeight"),
  "bottom tabs should apply font size, font style, and layout settings"
);
assert.ok(
  screenShell.includes("getTitleStyle(settings.fontStyle, fontSizeScale)"),
  "screen shell should apply font style and font size to page titles"
);
assert.ok(
  actionRow.includes("fontSizeScale") && actionRow.includes("layoutScale"),
  "action rows should apply font size and layout settings"
);
assert.ok(
  sectionBlock.includes("fontSizeScale") && sectionBlock.includes("layoutScale"),
  "section blocks should apply font size and layout settings"
);

console.log("ok - app appearance settings propagate to shared UI");
