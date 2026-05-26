import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/photo-library.ts", "utf8");

for (const snippet of [
  "const normalizeCapturedPhotoForRatio = async",
  "const normalizedSource = await normalizeCapturedPhotoForRatio({",
  "sourceUri: normalizedSource.uri",
  "width: normalizedSource.width",
  "height: normalizedSource.height",
  "...normalizedSource.temporaryUris",
  "format: SaveFormat.JPEG"
]) {
  assert.ok(
    source.includes(snippet),
    `captured camera ratio should normalize source dimensions before cropping: ${snippet}`
  );
}

console.log("ok - camera ratio crop normalizes captured files before saving");
