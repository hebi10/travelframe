import assert from "node:assert/strict";
import fs from "node:fs";

const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const storageModeSource = fs.readFileSync("lib/storage-mode.ts", "utf8");
const cloudBackupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
const videoLibrarySource = fs.readFileSync("lib/video-library.ts", "utf8");
const workLibrarySource = fs.readFileSync("lib/work-library.ts", "utf8");
const userMusicSource = fs.readFileSync("lib/user-music.ts", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");
const accountSource = fs.readFileSync("app/(tabs)/account.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");

for (const snippet of [
  'export type StorageMode = "local_only" | "local_backup" | "local_saver"',
  'storageMode: "local_only"',
  'nextSettings.cloudBackupEnabled ? "local_backup" : "local_only"'
]) {
  assert.ok(appSettingsSource.includes(snippet), `app settings storage mode missing: ${snippet}`);
}

for (const snippet of [
  "STORAGE_MODE_OPTIONS",
  "로컬 저장만 사용",
  "로컬 저장 + 클라우드 백업",
  "로컬 용량 절약 모드",
  "isCloudBackupStorageMode",
  "isStorageSaverMode",
  "getEffectiveStorageMode"
]) {
  assert.ok(storageModeSource.includes(snippet), `storage mode policy missing: ${snippet}`);
}

for (const snippet of [
  "applyStorageSaverPolicy",
  "isStorageSaverMode(settings.storageMode, true)",
  "markPhotoCloudOnly",
  "markImageBundleCloudOnly",
  "markMadeVideoCloudOnly"
]) {
  assert.ok(cloudBackupSource.includes(snippet), `cloud backup storage saver flow missing: ${snippet}`);
}

for (const [name, source, restoreSnippet, markSnippet] of [
  ["photo library", photoLibrarySource, "restorePhotoOriginalIfNeeded", "markPhotoCloudOnly"],
  ["video library", videoLibrarySource, "restoreMadeVideoIfNeeded", "markMadeVideoCloudOnly"],
  ["work library", workLibrarySource, "restoreImageBundleWorkIfNeeded", "markImageBundleCloudOnly"]
]) {
  assert.ok(source.includes(restoreSnippet), `${name} should restore cloud-only originals on open`);
  assert.ok(source.includes(markSnippet), `${name} should mark originals as cloud-only after backup`);
}

for (const snippet of [
  "storageMode",
  "isStorageSaverMode(settings.storageMode, true)",
  "deleteLocalMusicFile",
  "restoreUserMusicTrackIfNeeded"
]) {
  assert.ok(userMusicSource.includes(snippet), `user music storage mode missing: ${snippet}`);
}

for (const snippet of [
  "restoreUserMusicTrackIfNeeded",
  "const restoredTrack = await restoreUserMusicTrackIfNeeded(user, selectedUserMusic)",
  "exportMusicUri"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip music restore before export missing: ${snippet}`);
}

assert.ok(
  photoLibrarySource.includes("if (isRemoteUri(uri))"),
  "photo library should not try to delete remote backup URLs as local files"
);

for (const snippet of [
  "저장 방식",
  "로컬 저장만 사용",
  "로컬 저장 + 클라우드 백업",
  "로컬 용량 절약 모드",
  "getEffectiveStorageMode",
  "STORAGE_MODE_OPTIONS"
]) {
  assert.ok(settingsSource.includes(snippet), `settings storage mode UI missing: ${snippet}`);
}

for (const snippet of [
  "저장 방식",
  "getStorageModeLabel(effectiveStorageMode)",
  "getEffectiveStorageMode"
]) {
  assert.ok(accountSource.includes(snippet), `account storage mode UI missing: ${snippet}`);
}

console.log("ok - storage mode policy is wired through settings, backup, restore, and local cleanup");
