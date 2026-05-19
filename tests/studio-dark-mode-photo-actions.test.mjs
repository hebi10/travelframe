import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(tabs)/studio.tsx", "utf8");
const photoCardStart = source.indexOf("function PhotoCard");
const photoCardEnd = source.indexOf("function PageSizeSelector");

assert.ok(photoCardStart >= 0, "studio screen should define PhotoCard");
assert.ok(photoCardEnd > photoCardStart, "studio screen should define PageSizeSelector after PhotoCard");

const photoCard = source.slice(photoCardStart, photoCardEnd);

for (const snippet of [
  "const secondaryButtonStyle",
  "borderColor: palette.line",
  "backgroundColor: palette.background",
  "const secondaryButtonTextStyle",
  "color: palette.text",
  "const secondaryDeleteButtonTextStyle",
  "color: palette.muted",
  "style={[styles.cardLightButton, secondaryButtonStyle]}",
  "style={[styles.cardLightButtonText, secondaryButtonTextStyle]}",
  "style={[styles.cardDeleteButtonText, secondaryDeleteButtonTextStyle]}"
]) {
  assert.ok(source.includes(snippet), `studio dark photo action style missing: ${snippet}`);
}

console.log("ok - studio photo action buttons use dark-mode palette colors");
