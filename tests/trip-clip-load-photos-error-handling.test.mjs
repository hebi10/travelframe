import assert from "node:assert/strict";
import fs from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const source = readTripClipSource();
const loadPhotosSource = source.slice(
  source.indexOf("const loadPhotos"),
  source.indexOf("  const applyPreviewGuideSize")
);

assert.ok(loadPhotosSource.includes("try {"), "loadPhotos should guard async loading work");
assert.ok(loadPhotosSource.includes("} catch (error) {"), "loadPhotos should surface load failures");
assert.ok(loadPhotosSource.includes("} finally {"), "loadPhotos should always clear loading state");
assert.ok(
  loadPhotosSource.includes('setExportMessage(getUserFacingErrorMessage(error, "사진을 불러오지 못했습니다."));'),
  "loadPhotos should show a user-facing error message when loading fails"
);
assert.ok(
  loadPhotosSource.includes("setIsLoading(false);"),
  "loadPhotos should clear the loading indicator after success or failure"
);

console.log("ok - trip clip photo loading failures clear the loading state");
