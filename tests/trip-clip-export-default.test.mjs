import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = [
  readTripClipSource(),
  readFileSync("features/trip-clip/trip-clip-screen.constants.ts", "utf8")
].join("\n");

assert.match(
  source,
  /useState<ExportFormat>\("mp4"\)/,
  "trip clip export format should default to MP4"
);

const optionsStart = source.indexOf("const EXPORT_FORMAT_OPTIONS");
const optionsEnd = source.indexOf("const IMAGE_SAVE_FORMAT_OPTIONS", optionsStart);
assert.notEqual(optionsStart, -1, "export format options should exist");
assert.notEqual(optionsEnd, -1, "image save options should follow export format options");

const optionsBlock = source.slice(optionsStart, optionsEnd);
const mp4Index = optionsBlock.indexOf('value: "mp4"');
const imagesIndex = optionsBlock.indexOf('value: "images"');

assert.ok(mp4Index >= 0, "MP4 export option should exist");
assert.ok(imagesIndex >= 0, "image export option should exist");
assert.ok(
  mp4Index < imagesIndex,
  "MP4 export option should be displayed before image export"
);

assert.match(
  source,
  /<Text selectable style=\{styles\.eyebrow\}>\s*영상 만들기\s*<\/Text>/,
  "trip clip screen eyebrow should say 영상 만들기"
);
