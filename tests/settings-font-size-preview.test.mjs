import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = [
  readFileSync("lib/app-settings.ts", "utf8"),
  readFileSync("app/(tabs)/settings.tsx", "utf8"),
  readFileSync("features/settings/settings-screen.components.tsx", "utf8")
].join("\n");

assert.ok(
  settingsSource.includes("getFontSizeScale"),
  "settings screen should reuse the shared font size scale helper"
);
assert.ok(
  settingsSource.includes("fontSizePreview?: FontSize"),
  "option buttons should accept a font size preview value"
);
assert.ok(
  settingsSource.includes(
    "const previewFontSizeScale = fontSizePreview ? getFontSizeScale(fontSizePreview) : fontSizeScale"
  ),
  "option buttons should derive preview text scale from the option value"
);
assert.ok(
  settingsSource.includes("fontSizePreview={fontSize.value}"),
  "font size modal should pass each option size into its option button"
);
assert.ok(
  settingsSource.includes("typography.body * previewFontSizeScale") &&
    settingsSource.includes("typography.small * previewFontSizeScale"),
  "font size modal button label and detail text should render with the preview scale"
);
assert.ok(
  settingsSource.includes('if (fontSize === "large")') &&
    settingsSource.includes("return 1.22"),
  "large font size should be visibly larger than the default by about 2-3px"
);

console.log("ok - settings font size modal previews each option text size");
