import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourceUrl = new URL("../lib/cloud-backup-limits.ts", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const {
  CLOUD_BACKUP_IMAGE_WORK_LIMIT,
  CLOUD_BACKUP_EXPERT_STORAGE_LIMIT_BYTES,
  CLOUD_BACKUP_EXPERT_VIDEO_LIMIT,
  CLOUD_BACKUP_PHOTO_LIMIT,
  CLOUD_BACKUP_STORAGE_LIMIT_BYTES,
  CLOUD_BACKUP_VIDEO_LIMIT,
  canBackupMoreVideos,
  getCloudBackupStorageLimitBytes,
  getCloudBackupVideoLimit,
  getRemainingBackupSlots
} = await import(`data:text/javascript,${encodeURIComponent(transpiled)}`);

assert.equal(CLOUD_BACKUP_PHOTO_LIMIT, 200);
assert.equal(CLOUD_BACKUP_IMAGE_WORK_LIMIT, 200);
assert.equal(CLOUD_BACKUP_VIDEO_LIMIT, 50);
assert.equal(CLOUD_BACKUP_STORAGE_LIMIT_BYTES, 2 * 1024 * 1024 * 1024);
assert.equal(CLOUD_BACKUP_EXPERT_VIDEO_LIMIT, 100);
assert.equal(CLOUD_BACKUP_EXPERT_STORAGE_LIMIT_BYTES, 5 * 1024 * 1024 * 1024);
assert.equal(getCloudBackupVideoLimit("pro"), 50);
assert.equal(getCloudBackupVideoLimit("expert"), 100);
assert.equal(getCloudBackupStorageLimitBytes("pro"), 2 * 1024 * 1024 * 1024);
assert.equal(getCloudBackupStorageLimitBytes("expert"), 5 * 1024 * 1024 * 1024);
assert.equal(getRemainingBackupSlots(2, CLOUD_BACKUP_PHOTO_LIMIT), 198);
assert.equal(getRemainingBackupSlots(49, CLOUD_BACKUP_VIDEO_LIMIT), 1);
assert.equal(getRemainingBackupSlots(50, CLOUD_BACKUP_VIDEO_LIMIT), 0);
assert.equal(getRemainingBackupSlots(51, CLOUD_BACKUP_VIDEO_LIMIT), 0);
assert.equal(canBackupMoreVideos(49), true);
assert.equal(canBackupMoreVideos(50), false);
assert.equal(canBackupMoreVideos(99, "expert"), true);
assert.equal(canBackupMoreVideos(100, "expert"), false);

console.log("ok - cloud backup limits are explicit");
