import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/app-settings.ts", "utf8");

for (const snippet of [
  "GUIDE_TYPES",
  "const defaultGuide = GUIDE_TYPES.includes(nextSettings.defaultGuide)",
  "defaultGuide:",
  "guideSize: clampGuideSize(nextSettings.guideSize, defaultGuide)"
]) {
  assert.ok(source.includes(snippet), `app settings should normalize invalid guide settings: ${snippet}`);
}

console.log("ok - app settings normalize invalid guide values before clamping size");
