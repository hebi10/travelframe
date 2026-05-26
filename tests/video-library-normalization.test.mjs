import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/video-library.ts", "utf8");
const videoDetailSource = fs.readFileSync("app/video/[id].tsx", "utf8");

for (const snippet of [
  "const normalizeMadeVideoItem =",
  "const normalizeVideoDurations =",
  "return Array.isArray(parsed) ? sortVideos(parsed.map(normalizeMadeVideoItem)) : [];",
  "photoIds: normalizeStringArray(video.photoIds)",
  "durations: normalizeVideoDurations(video.durations)",
  "duration: normalizeFiniteNumber(video.duration, 0)",
  "musicLabel: normalizeText(video.musicLabel, \"무음\")"
]) {
  assert.ok(source.includes(snippet), `video library should normalize stored video metadata: ${snippet}`);
}

assert.ok(
  videoDetailSource.includes("const videoSource = video?.uri || null;") &&
    videoDetailSource.includes("useVideoPlayer(videoSource"),
  "video detail should pass null, not an empty string, to expo-video"
);

console.log("ok - video library normalizes stored video metadata before rendering");
