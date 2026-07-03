import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("components/action-row.tsx", "utf8");

assert.match(
  source,
  /export function ActionRow\(\{[^}]*detail[^}]*\}/s,
  "ActionRow should read its detail prop"
);
assert.match(
  source,
  /styles\.detail[\s\S]*?\{detail\}/,
  "ActionRow should render detail text when provided"
);

console.log("ok - ActionRow renders detail text");
