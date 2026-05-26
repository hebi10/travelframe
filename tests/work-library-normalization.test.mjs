import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/work-library.ts", "utf8");

for (const snippet of [
  "const normalizeImageBundleWorkItem =",
  "return Array.isArray(parsed)",
  "? sortImageBundles(parsed.map(normalizeImageBundleWorkItem))",
  "photoIds: normalizeStringArray(work.photoIds)",
  "imageUris: normalizeStringArray(work.imageUris)",
  "imageWidths: normalizeNullableNumberArray(work.imageWidths)",
  "imageHeights: normalizeNullableNumberArray(work.imageHeights)"
]) {
  assert.ok(source.includes(snippet), `work library should normalize stored image bundle metadata: ${snippet}`);
}

console.log("ok - work library normalizes stored image bundle metadata before rendering");
