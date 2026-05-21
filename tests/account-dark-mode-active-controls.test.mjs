import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = [
  readFileSync("app/(tabs)/account.tsx", "utf8"),
  readFileSync("features/account/account-screen.styles.ts", "utf8")
].join("\n");

for (const snippet of [
  "activeFill: {",
  "backgroundColor: isDark ? palette.surfaceStrong : palette.text",
  "inverseText: {",
  "color: isDark ? palette.text : palette.inverse"
]) {
  assert.ok(source.includes(snippet), `account dark active control style missing: ${snippet}`);
}

assert.ok(
  !source.includes("backgroundColor: isDark ? palette.ink : palette.text"),
  "account dark active controls should not use a white ink background"
);

console.log("ok - account active controls avoid white dark-mode backgrounds");
