import assert from "node:assert/strict";
import fs from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const tripClipSource = readTripClipSource();
const videoLibrarySource = fs.readFileSync("lib/video-library.ts", "utf8");

for (const snippet of [
  "updateMadeVideo",
  "const isEditingMadeVideo = Boolean(videoId);",
  "const handleHeaderSavePress = () => {",
  "saveSelectedExport({ returnToVideoWorks: true })",
  "persistTripClipDraft(true)",
  "onPress={handleHeaderSavePress}",
  '{isEditingMadeVideo ? "저장" : "임시 저장"}',
  'setExportFormat("mp4");',
  'router.replace("/studio?tab=works" as Href)'
]) {
  assert.ok(
    tripClipSource.includes(snippet),
    `saved video edit save flow missing: ${snippet}`
  );
}

assert.ok(
  videoLibrarySource.includes("export const updateMadeVideo = async"),
  "video library should support updating an existing made video"
);

console.log("ok - saved video edit uses save action and returns to video works");
