import assert from "node:assert/strict";
import fs from "node:fs";

const tripClipSource = fs.readFileSync("app/trip-clip.tsx", "utf8");

for (const snippet of [
  "setWorkTitle(storedVideo.title)",
  "const normalizedWorkTitle = workTitle.trim()",
  "title: normalizedWorkTitle || undefined",
  "const savedVideo = await saveMadeVideo({"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip video title save missing: ${snippet}`);
}

const saveVideoStart = tripClipSource.indexOf("const savedVideo = await saveMadeVideo({");
assert.notEqual(saveVideoStart, -1, "saveMadeVideo call should exist");
const saveVideoEnd = tripClipSource.indexOf("});", saveVideoStart);
assert.notEqual(saveVideoEnd, -1, "saveMadeVideo call should close");
const saveVideoBlock = tripClipSource.slice(saveVideoStart, saveVideoEnd);

assert.ok(
  saveVideoBlock.includes("title: normalizedWorkTitle || undefined"),
  "MP4 save should pass the typed work title into saveMadeVideo"
);

console.log("ok - trip clip MP4 saves and restores the work title");
