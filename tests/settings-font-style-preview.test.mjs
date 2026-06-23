import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = [
  readFileSync("features/settings/SettingsScreen.tsx", "utf8"),
  readFileSync("features/settings/settings-screen.components.tsx", "utf8")
].join("\n");

assert.ok(
  settingsSource.includes("getFontFamilyForStyle"),
  "settings screen should reuse the shared font family helper"
);
assert.ok(
  settingsSource.includes("fontFamilyPreview?: FontStyle"),
  "option buttons should accept a font family preview value"
);
assert.ok(
  settingsSource.includes(
    "fontFamilyPreview ? getFontFamilyForStyle(fontFamilyPreview, fontsReady) : fontFamily"
  ),
  "option buttons should derive preview font family from the option value"
);
assert.ok(
  settingsSource.includes("const previewFontStyle = fontStylePreview ?? fontFamilyPreview;"),
  "option buttons should derive preview font weight from the preview font value"
);
assert.ok(
  settingsSource.includes("previewFontStyle ? getFontWeightForStyle(previewFontStyle) : emphasisWeight"),
  "font style modal should not reuse the currently selected font weight for every option"
);
assert.ok(
  settingsSource.includes("fontFamilyPreview={font.value}"),
  "font style modal should pass each option font family into its option button"
);
assert.ok(
  settingsSource.includes("fontFamily: previewFontFamily"),
  "font style modal button label and detail text should render with the preview font family"
);

console.log("ok - settings font style modal previews each option font family");
