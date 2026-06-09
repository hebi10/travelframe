import assert from "node:assert/strict";
import fs from "node:fs";

const storageRules = fs.readFileSync("storage.rules", "utf8");
const firestoreRules = fs.readFileSync("firestore.rules", "utf8");
const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const backupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");

for (const snippet of [
  "reserveBackupUpload",
  "completeBackupUpload",
  "releaseBackupUpload",
  "deleteCloudBackupData",
  "completeImageWorkBackup",
  "assertCompletedImageWorkSessions",
  "storagePaths.length !== backupSessionIds.length",
  "session.storagePath !== storagePaths[index]",
  'session.status !== "completed"',
  "backupUsage",
  "pendingUsage",
  "cleanupExpiredBackupUploadSessions",
  "buildBackupSessionStoragePath",
  "deleteBackupSessionStorageObject",
  "deleteUserBackupItem",
  "deleteBackupItemForUser",
  "metadata.metadata?.backupSessionId !== backupSessionId",
  "getBackupSubscription",
  "subscriptions/expert_monthly"
]) {
  assert.ok(functionsSource.includes(snippet), `Cloud Functions missing server backup enforcement: ${snippet}`);
}

const releaseBackupUploadStart = functionsSource.indexOf("exports.releaseBackupUpload");
const releaseBackupUploadEnd = functionsSource.indexOf("const getStringList", releaseBackupUploadStart);
assert.ok(
  releaseBackupUploadStart >= 0 && releaseBackupUploadEnd > releaseBackupUploadStart,
  "releaseBackupUpload callable should exist"
);
const releaseBackupUploadSource = functionsSource.slice(
  releaseBackupUploadStart,
  releaseBackupUploadEnd
);
assert.equal(
  releaseBackupUploadSource.includes('session.status === "completed"'),
  false,
  "releaseBackupUpload must not let clients release completed sessions and subtract completed usage"
);
assert.equal(
  releaseBackupUploadSource.includes("releaseCompletedBackupUsage"),
  false,
  "completed backup usage should only be reduced by server-owned backup item deletion"
);
assert.ok(
  releaseBackupUploadSource.includes('session.status !== "reserved"'),
  "releaseBackupUpload should be a no-op for every non-reserved session"
);

const deleteBackupItemStart = functionsSource.indexOf("const deleteBackupItemForUser");
const deleteBackupItemEnd = functionsSource.indexOf("exports.deleteUserBackupItem", deleteBackupItemStart);
assert.ok(
  deleteBackupItemStart >= 0 && deleteBackupItemEnd > deleteBackupItemStart,
  "deleteBackupItemForUser should exist"
);
const deleteBackupItemSource = functionsSource.slice(deleteBackupItemStart, deleteBackupItemEnd);
assert.ok(
  deleteBackupItemSource.includes("releaseCompletedBackupUsage") ||
    deleteBackupItemSource.includes("refreshAdminBackupOverview"),
  "backup item deletion should be the server-owned path that reduces completed usage"
);

const sanitizeImageWorkStart = functionsSource.indexOf("const sanitizeImageWorkBackupData");
const completeImageWorkEnd = functionsSource.indexOf("exports.reserveMusicUpload", sanitizeImageWorkStart);
assert.ok(
  sanitizeImageWorkStart >= 0 && completeImageWorkEnd > sanitizeImageWorkStart,
  "completeImageWorkBackup implementation should exist"
);
const completeImageWorkSource = functionsSource.slice(sanitizeImageWorkStart, completeImageWorkEnd);
assert.ok(
  completeImageWorkSource.includes("safeImageUris"),
  "completeImageWorkBackup should derive imageUris from completed Storage objects instead of trusting client URLs"
);
assert.ok(
  completeImageWorkSource.includes("getDownloadUrlFromStorageMetadata"),
  "completeImageWorkBackup should derive download URLs from Storage metadata"
);

for (const snippet of [
  "backupUploadSessions",
  "backupSessionId",
  "firestore.get",
  "storagePath",
  "fileSize",
  "contentType"
]) {
  assert.ok(storageRules.includes(snippet), `Storage Rules missing upload session enforcement: ${snippet}`);
}

for (const snippet of [
  "match /backupUsage/{usageId}",
  "allow create, update, delete: if false",
  "isValidPhotoBackupMetadata",
  "isValidVideoBackupMetadata",
  "match /imageWorks/{workId}",
  "allow create, update: if false",
  "allow delete: if false",
  "storagePath",
  "fileSize",
  "isValidBackupDownloadUrl",
  "isValidPhotoBackupUrls",
  "isValidVideoBackupUrls",
  "request.resource.data.fileSize == resource.data.fileSize",
  "request.resource.data.fileType == resource.data.fileType"
]) {
  assert.ok(firestoreRules.includes(snippet), `Firestore Rules missing backup metadata hardening: ${snippet}`);
}

for (const snippet of [
  "httpsCallable",
  "reserveBackupUpload",
  "completeBackupUpload",
  "completeImageWorkBackup",
  "backupSessionId",
  "fileSize",
  "deleteCloudBackupDataCallable",
  "deleteUserBackupItem"
]) {
  assert.ok(backupSource.includes(snippet), `client backup flow missing server function call: ${snippet}`);
}

console.log("ok - backup upload and usage enforcement is anchored on server checks");
