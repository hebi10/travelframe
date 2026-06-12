import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appAppearanceSource = readFileSync("lib/app-appearance.ts", "utf8");
const screenShellSource = readFileSync("components/screen-shell.tsx", "utf8");
const settingsStylesSource = readFileSync("features/settings/settings-screen.styles.ts", "utf8");
const settingsComponentsSource = readFileSync("features/settings/settings-screen.components.tsx", "utf8");
const settingsScreenSource = readFileSync("app/(tabs)/settings.tsx", "utf8");
const accountStylesSource = readFileSync("features/account/account-screen.styles.ts", "utf8");
const accountComponentsSource = readFileSync("features/account/account-screen.components.tsx", "utf8");
const accountScreenSource = readFileSync("app/(tabs)/account.tsx", "utf8");

assert.ok(
  appAppearanceSource.includes('export type AppFontWeight = "400" | "700" | "800" | "900"'),
  "font weights should allow regular custom fonts without Android fallback"
);
assert.ok(
  appAppearanceSource.includes('fontStyle === "noto_sans_kr"') &&
    appAppearanceSource.includes('return "800"') &&
    appAppearanceSource.includes('return "400"'),
  "single-weight bundled fonts should avoid unsupported bold weights"
);
assert.ok(
  screenShellSource.includes("getFontWeightForStyle(fontStyle)"),
  "screen titles should use the same Android-safe font weight helper"
);

for (const source of [settingsStylesSource, accountStylesSource]) {
  assert.ok(
    source.includes("fontFamily?: string") &&
      source.includes("const fontTextStyle = fontFamily ? { fontFamily } : {};"),
    "themed styles should accept and compose the selected font family"
  );
  assert.ok(
    source.includes("...fontTextStyle"),
    "themed text, muted, inverse, and input styles should include the selected font family"
  );
}

assert.ok(
  settingsScreenSource.includes("const { palette, fontFamily } = useAppAppearance();") &&
    settingsScreenSource.includes("createThemedStyles(palette, fontFamily)") &&
    settingsScreenSource.includes("[palette, fontFamily]"),
  "settings screen should pass selected font family into local themed styles"
);
assert.ok(
  accountScreenSource.includes("const { palette, fontFamily } = useAppAppearance();") &&
    accountScreenSource.includes("createAccountThemedStyles(palette, fontFamily)") &&
    accountScreenSource.includes("[palette, fontFamily]"),
  "account screen should pass selected font family into local themed styles"
);
assert.ok(
  accountComponentsSource.includes("const { palette, fontFamily } = useAppAppearance();") &&
    accountComponentsSource.includes("createAccountThemedStyles(palette, fontFamily)"),
  "account subcomponents should pass selected font family into local themed styles"
);
assert.ok(
  settingsComponentsSource.includes("fontFamily, emphasisWeight") &&
    settingsComponentsSource.includes("fontFamily,") &&
    settingsComponentsSource.includes("fontWeight: emphasisWeight"),
  "settings custom controls should apply the selected font family directly"
);

console.log("ok - selected font family propagates through themed app UI");
