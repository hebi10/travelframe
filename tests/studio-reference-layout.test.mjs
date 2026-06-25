import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const source = readStudioSource();

for (const snippet of [
  "function StudioIcon",
  '<StudioIcon kind={tab.value} active={isActive} />',
  '<StudioIcon kind="upload" active />',
  "styles.importImageCopy",
  "styles.importImageTitle",
  "styles.importImageDetail"
]) {
  assert.ok(source.includes(snippet), `studio reference layout missing: ${snippet}`);
}

assert.ok(
  source.includes("numColumns={2}"),
  "photo browsing should keep the existing two-column grid"
);

console.log("ok - studio applies the reference layout without replacing the photo grid");
