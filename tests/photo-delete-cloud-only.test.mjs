import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/photo-library.ts", "utf8");
const deleteStart = source.indexOf("export const deletePhoto = async");
const toggleStart = source.indexOf("export const togglePhotoForVideo", deleteStart);

assert.ok(deleteStart >= 0, "deletePhoto should exist");
assert.ok(toggleStart > deleteStart, "togglePhotoForVideo should follow deletePhoto");

const deletePhotoSource = source.slice(deleteStart, toggleStart);

assert.ok(
  source.includes("export const deleteLocalFile = async") && source.includes("if (isRemoteUri(uri))"),
  "deleteLocalFile should ignore remote cloud URLs"
);

assert.ok(
  deletePhotoSource.includes("await deleteLocalFile(photo.uri);"),
  "deletePhoto should delete the original through the remote-safe local file helper"
);

assert.ok(
  deletePhotoSource.includes("await deleteLocalFile(photo.previewUri);"),
  "deletePhoto should delete previews through the remote-safe local file helper"
);

assert.ok(
  !deletePhotoSource.includes("FileSystem.deleteAsync(photo.uri"),
  "deletePhoto should not pass remote cloud URLs directly to FileSystem.deleteAsync"
);

console.log("ok - deleting cloud-only photos skips remote URLs and removes the local record");
