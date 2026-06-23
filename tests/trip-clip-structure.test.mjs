import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

const tripClipSource = readTripClipSource();

for (const path of [
  "lib/trip-clip-playback.ts",
  "components/trip-clip-recording-canvas.tsx"
]) {
  assert.ok(fs.existsSync(path), `trip clip structure file should exist: ${path}`);
}

for (const snippet of [
  "@/lib/trip-clip-playback",
  "@/components/trip-clip-recording-canvas",
  "getDefaultFrameDuration",
  "getRecordingFrame",
  "TripClipRecordingCanvas"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip should use extracted boundary: ${snippet}`);
}

assert.equal(
  tripClipSource.includes("function TripClipRecordingCanvas"),
  false,
  "recording canvas should not stay inside app/(tabs)/trip-clip.tsx"
);

console.log("ok - trip clip has extracted playback and recording boundaries");
