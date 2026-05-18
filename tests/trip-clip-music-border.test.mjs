import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/trip-clip.tsx", "utf8");
const musicRowMatch = source.match(/musicRow: \{[\s\S]*?\n  \},/);

assert.ok(musicRowMatch, "musicRow style should exist");

const musicRowStyle = musicRowMatch[0];

assert.ok(
  musicRowStyle.includes("borderWidth: 1"),
  "music row should render a full 1px border"
);

assert.ok(
  !musicRowStyle.includes("borderBottomWidth: StyleSheet.hairlineWidth"),
  "music row bottom border should not be downgraded to hairline width"
);

console.log("ok - trip clip music row keeps visible bottom border");
