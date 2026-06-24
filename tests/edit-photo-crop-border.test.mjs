import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("components/editable-photo-canvas.tsx", "utf8");

const cropBorderMatch = source.match(/cropBorder:\s*\{(?<body>[\s\S]*?)\n  \}/);

assert.ok(cropBorderMatch?.groups?.body, "Editable photo canvas should define cropBorder");

const cropBorder = cropBorderMatch.groups.body;

assert.ok(cropBorder.includes("borderWidth: 2"), "crop border outline should remain visible");
assert.ok(
  cropBorder.includes('borderColor: "rgba(255, 255, 255, 0.96)"'),
  "crop border should keep the bright outline"
);

for (const removedShadowStyle of [
  "shadowColor",
  "shadowOpacity",
  "shadowRadius",
  "shadowOffset",
  "elevation"
]) {
  assert.ok(
    !cropBorder.includes(removedShadowStyle),
    `crop border should not render the dark translucent band via ${removedShadowStyle}`
  );
}

console.log("ok - edit photo crop border keeps outline without dark band");
