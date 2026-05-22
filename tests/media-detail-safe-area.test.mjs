import assert from "node:assert/strict";
import fs from "node:fs";

const photoSource = fs.readFileSync("app/photo/[id].tsx", "utf8");
const videoSource = fs.readFileSync("app/video/[id].tsx", "utf8");

for (const [name, source] of [
  ["photo detail", photoSource],
  ["video detail", videoSource]
]) {
  for (const snippet of [
    "useSafeAreaInsets",
    "const insets = useSafeAreaInsets();",
    "const bottomSafePadding = Math.max(insets.bottom + spacing.screen, spacing.screen);",
    "contentContainerStyle={[styles.content, { paddingBottom: bottomSafePadding }]}"
  ]) {
    assert.ok(source.includes(snippet), `${name} safe area missing: ${snippet}`);
  }
}

console.log("ok - media detail screens reserve bottom safe area");
