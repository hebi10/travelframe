import assert from "node:assert/strict";
import fs from "node:fs";

const backupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const imageUtilsSource = fs.readFileSync("lib/image-backup-utils.ts", "utf8");

const section = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing section start: ${start}`);
  assert.ok(endIndex > startIndex, `missing section end after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
};

const normalizePhotoBackupSource = section(
  backupSource,
  "const normalizePhotoBackup",
  "const normalizeImageWorkBackup"
);
const normalizeImageWorkBackupSource = section(
  backupSource,
  "const normalizeImageWorkBackup",
  "const normalizeVideoBackup"
);
const normalizeVideoBackupSource = section(
  backupSource,
  "const normalizeVideoBackup",
  "export const restoreCloudBackupToLocal"
);

for (const [name, source] of [
  ["photo restore", normalizePhotoBackupSource],
  ["image bundle restore", normalizeImageWorkBackupSource],
  ["video restore", normalizeVideoBackupSource]
]) {
  assert.ok(
    source.includes('localFileStatus: "cloud_only"'),
    `${name} should mark restored cloud backup metadata as cloud-only`
  );
  assert.ok(
    source.includes('backupStatus: "backed_up"'),
    `${name} should preserve restored backup records as backed up, not local restored files`
  );
  assert.ok(
    !source.includes('backupStatus: "restored"'),
    `${name} should not imply cloud restore downloaded a local file`
  );
}

const backupCurrentWorkspaceSource = section(
  backupSource,
  "export const backupCurrentWorkspace",
  "export const backupPhoto"
);

for (const snippet of [
  'photo.localFileStatus === "cloud_only"',
  'work.localFileStatus === "cloud_only"',
  'video.localFileStatus === "cloud_only"'
]) {
  assert.ok(
    backupCurrentWorkspaceSource.includes(snippet),
    `workspace re-backup should skip cloud-only records before optimization/upload: ${snippet}`
  );
}

for (const [name, start, end, snippet] of [
  ["single photo backup", "export const backupPhoto = async", "export const backupPhotoIfEnabled", 'photo.localFileStatus === "cloud_only"'],
  ["single image bundle backup", "export const backupImageBundleWork = async", "export const backupMadeVideo", 'work.localFileStatus === "cloud_only"'],
  ["single video backup", "export const backupMadeVideo = async", "const normalizePhotoBackup", 'video.localFileStatus === "cloud_only"']
]) {
  const source = section(backupSource, start, end);
  assert.ok(source.includes(snippet), `${name} should not re-upload a cloud-only remote URL`);
}

const getLocalFileSizeSource = section(
  imageUtilsSource,
  "const getLocalFileSize",
  "export const optimizeImageForStorage"
);
const remoteGuardIndex = getLocalFileSizeSource.indexOf("isRemoteUri(uri)");
const getInfoIndex = getLocalFileSizeSource.indexOf("FileSystem.getInfoAsync(uri)");
assert.ok(remoteGuardIndex >= 0, "image optimization should identify remote URLs before file stat");
assert.ok(getInfoIndex >= 0, "image optimization should still stat local files");
assert.ok(
  remoteGuardIndex < getInfoIndex,
  "image optimization should not call FileSystem.getInfoAsync for https URLs"
);

console.log("ok - cloud restore keeps backups cloud-only and avoids remote URL re-backup");
