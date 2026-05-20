import assert from "node:assert/strict";
import fs from "node:fs";

const tripClipSource = fs.readFileSync("app/trip-clip.tsx", "utf8");

assert.match(
  tripClipSource,
  /<Text selectable style=\{styles\.title\}>\s*동영상\s*<\/Text>/,
  "trip clip screen title should say 동영상"
);

assert.doesNotMatch(
  tripClipSource,
  /<Text selectable style=\{styles\.title\}>\s*다중 편집\s*<\/Text>/,
  "trip clip screen title should no longer say 다중 편집"
);

console.log("ok - trip clip screen title copy is 동영상");
