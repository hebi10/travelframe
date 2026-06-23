import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const source = readStudioSource();

for (const snippet of [
  "type DeleteProgress",
  "const [deleteProgress, setDeleteProgress]",
  "const isSyncedPhoto = (photo: PhotoItem)",
  "setDeleteProgress({",
  "photo.backupStatus === \"backed_up\"",
  "photo.localFileStatus === \"cloud_only\"",
  "visible={Boolean(deleteProgress)}",
  "<ActivityIndicator color={palette.text} />",
  "setDeleteProgress(null);"
]) {
  assert.ok(source.includes(snippet), `studio synced photo delete progress missing: ${snippet}`);
}

assert.ok(
  source.indexOf("setDeleteProgress({") < source.indexOf("await deletePhoto(photo.id);"),
  "studio should show delete progress before running the photo deletion"
);

console.log("ok - studio shows progress while deleting synced photos");
