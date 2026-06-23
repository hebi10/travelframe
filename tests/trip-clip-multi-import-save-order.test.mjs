import assert from "node:assert/strict";
import fs from "node:fs";

const tripClipSource = fs.readFileSync("features/trip-clip/TripClipScreen.tsx", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");

const importStart = tripClipSource.indexOf("const pickPhotosFromPreview");
const importEnd = tripClipSource.indexOf("const handleAddUserMusic", importStart);
assert.ok(importStart >= 0 && importEnd > importStart, "trip clip import handler should exist");

const importSource = tripClipSource.slice(importStart, importEnd);

assert.equal(
  importSource.includes("Promise.all("),
  false,
  "trip clip multi-image import should not save photos concurrently"
);
assert.ok(
  importSource.includes("for (const asset of result.assets)") &&
    importSource.includes("savedPhotos.push(savedPhoto)"),
  "trip clip multi-image import should save selected images sequentially"
);

assert.ok(
  photoLibrarySource.includes("photoLibraryMutationChain") &&
    photoLibrarySource.includes("runPhotoLibraryMutation") &&
    photoLibrarySource.includes("return runPhotoLibraryMutation(async () => {"),
  "photo library writes should be serialized to avoid stale read-modify-write saves"
);

console.log("ok - trip clip multi-image imports save photos without concurrent list writes");
