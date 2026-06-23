import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const source = readStudioSource();

for (const snippet of [
  "clipAction: {",
  "paddingVertical: 12",
  "paddingHorizontal: 12",
  "clipActionText: {",
  "textAlign: \"center\"",
  "lineHeight: 19"
]) {
  assert.ok(source.includes(snippet), `studio CTA wrap style missing: ${snippet}`);
}

assert.ok(
  !source.includes("clipActionText: {\n    color: colors.inverse,\n    fontSize: typography.button,\n    fontWeight: \"800\",\n    lineHeight: 16"),
  "studio CTA text should not keep a clipped 16px line height"
);

console.log("ok - studio CTA text wraps without clipping");
