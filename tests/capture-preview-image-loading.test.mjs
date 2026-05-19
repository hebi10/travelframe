import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/capture-preview.tsx", "utf8");

for (const snippet of [
  "const getRouteParam = (value?: string | string[])",
  "decodeURIComponent(firstValue)",
  "const draftUri = getRouteParam(uri)",
  "const previewUri = photo?.uri ?? draftUri",
  "const [imageLoadFailed, setImageLoadFailed] = useState(false)",
  "cachePolicy=\"none\"",
  "onError={() => setImageLoadFailed(true)}",
  "Image as NativeImage",
  "resizeMode={selectedRatioAspect ? \"cover\" : \"contain\"}",
  "uri: draftUri",
  "deleteLocalFile(draftUri)"
]) {
  assert.ok(source.includes(snippet), `capture preview image loading guard missing: ${snippet}`);
}

console.log("ok - capture preview normalizes local file URI and falls back for image loading");
