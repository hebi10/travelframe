import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/capture-preview.tsx", "utf8");

for (const snippet of [
  "const getRouteParam = (value?: string | string[])",
  "decodeURIComponent(firstValue)",
  "const draftUri = getRouteParam(uri)",
  "const previewUri = photo?.uri ?? draftUri",
  "Image as NativeImage",
  "resizeMode={selectedRatioAspect ? \"cover\" : \"contain\"}",
  "uri: draftUri",
  "deleteLocalFile(draftUri)"
]) {
  assert.ok(source.includes(snippet), `capture preview image loading guard missing: ${snippet}`);
}

assert.ok(!source.includes("ExpoImage"), "capture preview should not use expo-image for local camera drafts");

console.log("ok - capture preview normalizes local file URI and renders local drafts with native image");
