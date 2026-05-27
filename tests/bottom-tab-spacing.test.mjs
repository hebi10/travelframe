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
  "const tabBarBottomPadding = Math.max(insets.bottom + 8, 16);",
  "const tabBarHeight = 58 + tabBarBottomPadding;",
  "paddingTop: 6",
  "minHeight: 46"
]) {
  assert.ok(tabsLayoutSource.includes(snippet), `tab spacing missing: ${snippet}`);
}

assert.ok(
  screenShellSource.includes("const TAB_BAR_BASE_HEIGHT = 58;"),
  "screen shell should reserve the tab bar base height"
);

assert.ok(
  screenShellSource.includes("const TAB_BAR_CONTENT_RESERVE_HEIGHT = TAB_BAR_BASE_HEIGHT;"),
  "screen shell should reserve the full tab bar base height"
);

assert.ok(
  screenShellSource.includes("const TAB_BAR_MIN_BOTTOM_PADDING = 16;"),
  "screen shell should include minimum safe bottom padding"
);

assert.ok(
  screenShellSource.includes(
    "TAB_BAR_CONTENT_RESERVE_HEIGHT +"
  ),
  "screen shell should reserve a reduced tab gap plus the bottom safe area"
);

console.log("ok - bottom tab spacing respects the full bottom safe area");
