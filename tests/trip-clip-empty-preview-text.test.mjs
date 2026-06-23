import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = [
  readTripClipSource(),
  fs.readFileSync("features/trip-clip/trip-clip-screen.styles.ts", "utf8")
].join("\n");

for (const snippet of [
  "numberOfLines={2}",
  "emptyPreview: {",
  "paddingHorizontal: 24",
  "paddingVertical: 24",
  "emptyPreviewText: {",
  "maxWidth: \"86%\"",
  "textAlign: \"center\"",
  "lineHeight: 34",
  "minHeight: 68",
  "includeFontPadding: true"
]) {
  assert.ok(source.includes(snippet), `trip clip empty preview text wrap guard missing: ${snippet}`);
}

assert.ok(
  !source.includes("emptyPreviewText: {\n    color: colors.inverse,\n    fontSize: typography.section,\n    fontWeight: \"800\",\n    letterSpacing: 0\n  }"),
  "empty preview text should not keep the clipped single-line-only style"
);

console.log("ok - trip clip empty preview text wraps without clipping");
