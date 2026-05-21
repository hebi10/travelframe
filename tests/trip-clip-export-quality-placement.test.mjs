import assert from "node:assert/strict";
import fs from "node:fs";

const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");
const exportSource = fs.readFileSync("lib/trip-clip-export.ts", "utf8");

const videoTabStart = tripClipSource.indexOf('{activeEditorTab === "video"');
const guideTabStart = tripClipSource.indexOf('{activeEditorTab === "guide"');
const exportTabStart = tripClipSource.indexOf('{activeEditorTab === "export"');
const previewActionsStart = tripClipSource.indexOf(
  '<View style={styles.previewActions}',
  exportTabStart
);

assert.ok(videoTabStart >= 0 && guideTabStart > videoTabStart, "video tab block should exist");
assert.ok(
  exportTabStart >= 0 && previewActionsStart > exportTabStart,
  "export tab block should exist"
);

const videoTabBlock = tripClipSource.slice(videoTabStart, guideTabStart);
const exportTabBlock = tripClipSource.slice(exportTabStart, previewActionsStart);

assert.ok(!videoTabBlock.includes("영상 화질"), "video quality should not remain in the video tab");
assert.ok(
  !videoTabBlock.includes("VIDEO_QUALITY_OPTIONS"),
  "video quality options should be rendered from the export tab"
);

for (const snippet of [
  "영상 화질",
  "VIDEO_QUALITY_OPTIONS",
  "VIDEO_QUALITY_DESCRIPTION",
  "이미지 화질",
  "IMAGE_QUALITY_OPTIONS",
  "IMAGE_QUALITY_DESCRIPTION"
]) {
  assert.ok(exportTabBlock.includes(snippet), `export quality UI missing: ${snippet}`);
}

for (const snippet of [
  "imageQuality",
  "saveImageToLibrary(photo.uri, imageSaveFormat, {",
  "shareImage(activePhoto.uri, imageSaveFormat, {"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip image quality wiring missing: ${snippet}`);
}

for (const snippet of [
  "ImageExportOptions",
  "getImageQualityOption",
  "getImageResizeAction",
  "prepareImageForLibrarySave(uri, format, options)"
]) {
  assert.ok(exportSource.includes(snippet), `image export quality handling missing: ${snippet}`);
}

console.log("ok - trip clip quality controls live in export tab");
