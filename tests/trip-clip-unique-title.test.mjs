import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const helperPath = "lib/trip-clip-title.ts";
const helperSource = existsSync(helperPath) ? readFileSync(helperPath, "utf8") : "";
const tripClipSource = readTripClipSource();

assert.ok(
  helperSource.includes('TRIP_CLIP_TITLE_PREFIX = "변화 영상"'),
  "title helper should use the Body Frame visible prefix"
);
assert.ok(
  helperSource.includes("getNextTripClipTitle") &&
    helperSource.includes("변화\\s*영상") &&
    helperSource.includes("여행\\s*클립") &&
    helperSource.includes("maxNumber + 1"),
  "title helper should derive the next number from current and legacy video titles"
);

for (const snippet of [
  "getNextTripClipTitle",
  "getImageBundleWorks",
  "getMadeVideos",
  "storedVideos.map((video) => video.title)",
  "storedImageBundles.map((bundle) => bundle.title)",
  "const nextWorkTitle = getNextTripClipTitle([",
  "setWorkTitle((current) => current.trim() ? current : nextWorkTitle)"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip should seed unique title: ${snippet}`);
}

console.log("ok - Body Frame videos use the next unique title across legacy data");
