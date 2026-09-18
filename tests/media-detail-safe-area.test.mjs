import assert from "node:assert/strict";
import fs from "node:fs";

const photoSource = fs.readFileSync("app/photo/[id].tsx", "utf8");
const videoSource = fs.readFileSync("app/video/[id].tsx", "utf8");

assert.ok(
  photoSource.includes("useSafeAreaInsets") &&
    photoSource.includes("const insets = useSafeAreaInsets();") &&
    photoSource.includes("paddingTop: Math.max(insets.top + 12, 20)") &&
    photoSource.includes("paddingBottom: insets.bottom + 36"),
  "Body Frame photo detail should reserve top and bottom safe areas"
);

for (const snippet of [
  "useSafeAreaInsets",
  "const insets = useSafeAreaInsets();",
  "const bottomSafePadding = Math.max(insets.bottom + spacing.screen, spacing.screen);",
  "contentContainerStyle={[styles.content, { paddingBottom: bottomSafePadding }]}"
]) {
  assert.ok(videoSource.includes(snippet), `video detail safe area missing: ${snippet}`);
}

console.log("ok - media detail screens reserve safe areas");
