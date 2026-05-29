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
  "metadata.metadata?.backupSessionId !== backupSessionId",
  "getBackupSubscription",
  "subscriptions/expert_monthly"
]) {
  assert.ok(functionsSource.includes(snippet), `Cloud Functions missing server backup enforcement: ${snippet}`);
}

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
  "storagePath",
  "fileSize"
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
  "deleteCloudBackupDataCallable"
]) {
  assert.ok(backupSource.includes(snippet), `client backup flow missing server function call: ${snippet}`);
}

console.log("ok - backup upload and usage enforcement is anchored on server checks");
