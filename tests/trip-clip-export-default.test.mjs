import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = [
  readFileSync("app/(tabs)/trip-clip.tsx", "utf8"),
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

assert.ok(
  source.includes("\uC5EC\uD589\uD074\uB9BD \uB9CC\uB4E4\uAE30"),
  "trip clip screen title should say 여행클립 만들기"
);
