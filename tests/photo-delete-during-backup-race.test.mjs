import assert from "node:assert/strict";
import fs from "node:fs";

const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
const backupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const quotaSource = fs.readFileSync("functions/backup-quota.js", "utf8");

for (const snippet of [
  "PHOTO_DELETION_MARKER_KEY",
  "export const recordPhotoLocalDeletion",
  "export const wasPhotoDeletedLocally",
  "await recordPhotoLocalDeletion(id);"
]) {
  assert.ok(
    photoLibrarySource.includes(snippet),
    `photo deletion should leave a local tombstone for in-flight backup checks: ${snippet}`
  );
}

for (const snippet of [
  "wasPhotoDeletedLocally",
  "const isPhotoStillBackupEligible = async (photoId: string)",
  "if (!(await isPhotoStillBackupEligible(photo.id)))",
  "await removeBackupIfPhotoWasDeleted({",
  "backupSessionId: photoUpload.backupSessionId",
  "await releaseBackupUpload({",
  "await deleteDoc(doc(firestore, \"users\", user.uid, \"photoBackups\", photo.id));"
]) {
  assert.ok(
    backupSource.includes(snippet),
    `cloud backup should skip or remove photos deleted while backup is in flight: ${snippet}`
  );
}

for (const snippet of [
  "const releaseCompletedBackupUsage",
  "exports.releaseCompletedBackupUsage = releaseCompletedBackupUsage"
]) {
  assert.ok(
    quotaSource.includes(snippet),
    `server quota should be able to subtract completed uploads deleted during backup: ${snippet}`
  );
}

for (const snippet of [
  "releaseCompletedBackupUsage",
  'session.status === "completed"',
  'status: "released"'
]) {
  assert.ok(
    functionsSource.includes(snippet),
    `releaseBackupUpload should clean up completed in-flight uploads: ${snippet}`
  );
}

const backupPhotoStart = backupSource.indexOf("export const backupPhoto = async");
const backupPhotoEnd = backupSource.indexOf("export const backupPhotoIfEnabled", backupPhotoStart);
assert.ok(backupPhotoStart >= 0 && backupPhotoEnd > backupPhotoStart, "backupPhoto should exist");

const backupPhotoSource = backupSource.slice(backupPhotoStart, backupPhotoEnd);
assert.ok(
  backupPhotoSource.indexOf("if (!(await isPhotoStillBackupEligible(photo.id)))") <
    backupPhotoSource.indexOf("const optimized = await optimizeImageForBackup"),
  "single-photo backup should check deletion before expensive optimization"
);
assert.ok(
  backupPhotoSource.indexOf("if (!(await isPhotoStillBackupEligible(photo.id)))", backupPhotoSource.indexOf("const upload = await uploadLocalFile")) >
    backupPhotoSource.indexOf("const upload = await uploadLocalFile"),
  "single-photo backup should re-check deletion after upload before writing metadata"
);

const restoreStart = backupSource.indexOf("export const restoreCloudBackupToLocal");
const restoreEnd = backupSource.indexOf("export const markBackupExpired", restoreStart);
assert.ok(restoreStart >= 0 && restoreEnd > restoreStart, "restoreCloudBackupToLocal should exist");

const restoreSource = backupSource.slice(restoreStart, restoreEnd);
assert.ok(
  restoreSource.includes("const deletedPhotoIds = await getDeletedPhotoIds();") &&
    restoreSource.includes("!deletedPhotoIds.has(item.id)"),
  "restore should not re-import photos deleted on this device"
);

console.log("ok - in-flight photo backup skips locally deleted photos");
