import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

const tripClipSource = readTripClipSource();

assert.match(
  tripClipSource,
  /<Text selectable style=\{styles\.title\}>\s*\{isEditingMadeVideo\s*\?\s*"저장한 영상 편집"\s*:\s*"동영상"\}\s*<\/Text>/,
  "trip clip screen title should match the current video editing mode"
);

assert.doesNotMatch(
  tripClipSource,
  /<Text selectable style=\{styles\.title\}>\s*다중 편집\s*<\/Text>/,
  "trip clip screen title should no longer say 다중 편집"
);

console.log("ok - trip clip screen title follows video editing mode");
