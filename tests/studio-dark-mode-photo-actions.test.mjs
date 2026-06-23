import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const source = readStudioSource();
const photoCardStart = source.indexOf("function PhotoCard");
const photoCardEnd = source.indexOf("export function PageSizeSelector");

assert.ok(photoCardStart >= 0, "studio screen should define PhotoCard");
assert.ok(photoCardEnd > photoCardStart, "studio screen should define PageSizeSelector after PhotoCard");

const photoCard = source.slice(photoCardStart, photoCardEnd);

for (const snippet of [
  "const secondaryButtonStyle",
  "borderColor: palette.line",
  "backgroundColor: palette.background",
  "borderWidth: isDark ? 1 : 0",
  "const secondaryButtonTextStyle",
  "color: palette.text",
  "const secondaryDeleteButtonTextStyle",
  "color: palette.muted",
  "style={[styles.cardLightButton, secondaryButtonStyle]}",
  "style={[styles.cardLightButtonText, secondaryButtonTextStyle]}",
  "style={[styles.cardDeleteButtonText, secondaryDeleteButtonTextStyle]}"
]) {
  assert.ok(photoCard.includes(snippet), `studio dark photo action style missing: ${snippet}`);
}

console.log("ok - studio photo action buttons use dark-mode palette colors");
