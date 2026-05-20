import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../admin/index.html", import.meta.url), "utf8");
const functionsSource = fs.readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
const storageRules = fs.readFileSync(new URL("../storage.rules", import.meta.url), "utf8");

for (const snippet of [
  'import { getFunctions, httpsCallable }',
  'import { getDownloadURL, getStorage, ref, uploadBytesResumable }',
  'const backupTabs = ["image", "video", "music"];',
  'const backupPageSize = 10;',
  'const loadBackupItems = async (tab = activeBackupTab)',
  'const uploadAdminBackupFile = async (file)',
  'const removeBackupItem = async (item)'
]) {
  assert.ok(adminSource.includes(snippet), `admin backup manager missing: ${snippet}`);
}

for (const snippet of [
  'id="backupTabs"',
  'data-backup-tab="image"',
  'data-backup-tab="video"',
  'data-backup-tab="music"',
  'id="backupUploadInput"',
  'id="backupItemList"',
  'id="backupItemsPageInfo"'
]) {
  assert.ok(adminHtml.includes(snippet), `admin backup manager HTML missing: ${snippet}`);
}

for (const snippet of [
  "const requireAdminUid = async (request) =>",
  "exports.reserveAdminBackupUpload = onCall",
  "exports.completeAdminBackupUpload = onCall",
  "exports.deleteAdminBackupItem = onCall",
  "adminBackupUploadSessions",
  "refreshAdminBackupOverview"
]) {
  assert.ok(functionsSource.includes(snippet), `admin backup functions missing: ${snippet}`);
}

for (const snippet of [
  "function isAdmin()",
  "function hasAdminBackupSession()",
  "function isReservedAdminBackupUpload(userId, mediaKind)",
  'isReservedAdminBackupUpload(userId, "image")',
  'isReservedAdminBackupUpload(userId, "video")',
  "isReservedAdminMusicUpload(userId)"
]) {
  assert.ok(storageRules.includes(snippet), `admin storage rule missing: ${snippet}`);
}

console.log("ok - admin backup manager is wired");
