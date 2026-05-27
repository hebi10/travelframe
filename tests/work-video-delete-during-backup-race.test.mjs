import assert from "node:assert/strict";
import fs from "node:fs";

const workLibrarySource = fs.readFileSync("lib/work-library.ts", "utf8");
const videoLibrarySource = fs.readFileSync("lib/video-library.ts", "utf8");
const backupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");

for (const snippet of [
  "IMAGE_BUNDLE_DELETION_MARKER_KEY",
  "export const getDeletedImageWorkIds",
  "export const recordImageWorkLocalDeletion",
  "export const wasImageWorkDeletedLocally",
  "await recordImageWorkLocalDeletion(id);"
]) {
  assert.ok(workLibrarySource.includes(snippet), `image work deletion marker missing: ${snippet}`);
}

for (const snippet of [
  "VIDEO_DELETION_MARKER_KEY",
  "export const getDeletedVideoIds",
  "export const recordVideoLocalDeletion",
  "export const wasVideoDeletedLocally",
  "await recordVideoLocalDeletion(id);"
]) {
  assert.ok(videoLibrarySource.includes(snippet), `video deletion marker missing: ${snippet}`);
}

for (const snippet of [
  "const isImageWorkStillBackupEligible = async",
  "const isVideoStillBackupEligible = async",
  "releaseBackupUploads(backupSessionIds)",
  "await removeBackupIfImageWorkWasDeleted({",
  "await removeBackupIfVideoWasDeleted({",
  "const deletedImageWorkIds = await getDeletedImageWorkIds();",
  "const deletedVideoIds = await getDeletedVideoIds();"
]) {
  assert.ok(backupSource.includes(snippet), `backup/restore should defend work/video deletion races: ${snippet}`);
}

console.log("ok - image work and video backup skip locally deleted items");
