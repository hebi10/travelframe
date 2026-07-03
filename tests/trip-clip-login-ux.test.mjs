import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("features/trip-clip/TripClipScreen.tsx", "utf8");

assert.doesNotMatch(
  source,
  /Alert\.alert\([\s\S]*?\);\s*router\.replace\("\/account" as Href\);/,
  "trip clip should not automatically navigate away after showing the login alert"
);
assert.match(
  source,
  /\{ text: "로그인하기", onPress: \(\) => router\.push\("\/account" as Href\) \}/,
  "trip clip login alert should offer an explicit login action"
);
assert.match(
  source,
  /\{ text: "나중에", style: "cancel" \}/,
  "trip clip login alert should allow staying in the editor"
);

console.log("ok - trip clip login prompt keeps the editor in place");
