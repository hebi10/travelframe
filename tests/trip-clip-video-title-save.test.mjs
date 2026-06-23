import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

const tripClipSource = readTripClipSource();

for (const snippet of [
  "setWorkTitle(storedVideo.title)",
  "const normalizedWorkTitle = workTitle.trim()",
  "title: normalizedWorkTitle || undefined",
  "const videoPayload: Parameters<typeof saveMadeVideo>[0] = {",
  "savedVideo = await saveMadeVideo(videoPayload,"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip video title save missing: ${snippet}`);
}

const saveVideoStart = tripClipSource.indexOf("const videoPayload: Parameters<typeof saveMadeVideo>[0] = {");
assert.notEqual(saveVideoStart, -1, "videoPayload should exist");
const saveVideoEnd = tripClipSource.indexOf("};", saveVideoStart);
assert.notEqual(saveVideoEnd, -1, "videoPayload should close");
const saveVideoBlock = tripClipSource.slice(saveVideoStart, saveVideoEnd);

assert.ok(
  saveVideoBlock.includes("title: normalizedWorkTitle || undefined"),
  "MP4 save should pass the typed work title into saveMadeVideo"
);

console.log("ok - trip clip MP4 saves and restores the work title");
