import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = readFileSync("app/(tabs)/settings.tsx", "utf8");

for (const removedSnippet of [
  'label="화면 구성"',
  'return "화면 구성"',
  'setActiveSetting("screenLayout")',
  'activeSetting === "screenLayout"',
  "screenLayoutOptions",
  "screenLayoutLabel"
]) {
  assert.ok(
    !settingsSource.includes(removedSnippet),
    `settings screen should not expose screen layout controls: ${removedSnippet}`
  );
}

console.log("ok - settings screen no longer exposes screen layout controls");
