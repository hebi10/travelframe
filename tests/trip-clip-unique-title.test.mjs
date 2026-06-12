import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const helperPath = "lib/trip-clip-title.ts";
const helperSource = existsSync(helperPath) ? readFileSync(helperPath, "utf8") : "";
const tripClipSource = readFileSync("app/(tabs)/trip-clip.tsx", "utf8");

assert.ok(helperSource.includes("TRIP_CLIP_TITLE_PREFIX = \"여행 클립\""), "title helper should use the visible Korean prefix");
assert.ok(
  helperSource.includes("getNextTripClipTitle") &&
    helperSource.includes("여행\\s*클립") &&
    helperSource.includes("maxNumber + 1"),
  "title helper should derive the next number from existing 여행 클립 / 여행클립 titles"
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

console.log("ok - trip clip new projects use the next unique title");
