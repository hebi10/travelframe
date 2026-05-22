import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/capture-preview.tsx", "utf8");

for (const snippet of [
  "useSafeAreaInsets",
  "const insets = useSafeAreaInsets();",
  "const bottomSafePadding = Math.max(insets.bottom + 20, 24);",
  "style={[styles.footer, { paddingBottom: bottomSafePadding }]}"
]) {
  assert.ok(source.includes(snippet), `capture preview safe area missing: ${snippet}`);
}

console.log("ok - capture preview footer respects bottom safe area");
