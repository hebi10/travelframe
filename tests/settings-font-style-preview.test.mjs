import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = [
  readFileSync("app/(tabs)/settings.tsx", "utf8"),
  readFileSync("features/settings/settings-screen.components.tsx", "utf8")
].join("\n");

assert.ok(
  settingsSource.includes("getFontWeightForStyle"),
  "settings screen should reuse the shared font style weight helper"
);
assert.ok(
  settingsSource.includes("fontStylePreview?: FontStyle"),
  "option buttons should accept a font style preview value"
);
assert.ok(
  settingsSource.includes(
    "const previewFontWeight = fontStylePreview ? getFontWeightForStyle(fontStylePreview) : emphasisWeight"
  ),
  "option buttons should derive preview font weight from the option value"
);
assert.ok(
  settingsSource.includes("fontStylePreview={font.value}"),
  "font style modal should pass each option style into its option button"
);
assert.ok(
  settingsSource.includes("fontWeight: previewFontWeight"),
  "font style modal button label and detail text should render with the preview weight"
);

console.log("ok - settings font style modal previews each option text weight");
