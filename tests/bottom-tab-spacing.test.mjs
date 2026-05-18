import assert from "node:assert/strict";
import fs from "node:fs";

const tabsLayoutSource = fs.readFileSync(
  new URL("../app/(tabs)/_layout.tsx", import.meta.url),
  "utf8"
);
const screenShellSource = fs.readFileSync(
  new URL("../components/screen-shell.tsx", import.meta.url),
  "utf8"
);

for (const snippet of [
  "const tabBarBottomPadding = Math.max(Math.round(insets.bottom * 0.5) + 4, 10);",
  "const tabBarHeight = 58 + tabBarBottomPadding;",
  "paddingTop: 6",
  "minHeight: 46"
]) {
  assert.ok(tabsLayoutSource.includes(snippet), `tab spacing missing: ${snippet}`);
}

assert.ok(
  screenShellSource.includes("const TAB_BAR_RESERVED_HEIGHT = 52;"),
  "screen shell should reserve about half the previous bottom space"
);

console.log("ok - bottom tab spacing is compact");
