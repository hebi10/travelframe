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
  'const storageModes: StorageMode[] = ["local_only", "local_backup"]',
  'nextSettings.storageMode === "local_saver" ? "local_backup"',
  'nextSettings.cloudBackupEnabled ? "local_backup" : "local_only"'
]) {
  assert.ok(appSettingsSource.includes(snippet), `app settings storage mode missing: ${snippet}`);
}

for (const snippet of [
  "STORAGE_MODE_OPTIONS",
  "앱 보관함에만 저장",
  "사진과 작업물을 이 핸드폰의 앱 보관함에만 저장합니다.",
  "클라우드 백업",
  "앱 보관함에 저장하고 클라우드 백업 설정이 켜져 있으면 계정에도 백업합니다.",
  "isCloudBackupStorageMode",
  "isStorageSaverMode",
  "getEffectiveStorageMode"
]) {
  assert.ok(storageModeSource.includes(snippet), `storage mode policy missing: ${snippet}`);
}

assert.equal(
  (storageModeSource.match(/value: "local_/g) ?? []).length,
  2,
  "storage mode picker should only expose two choices"
);
assert.ok(
  !storageModeSource.includes('value: "local_saver"'),
  "storage mode picker should not expose local_saver"
);
assert.ok(
  !storageModeSource.includes("앱 용량 절약 모드"),
  "storage mode copy should not mention app capacity saver mode"
);

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
  assert.ok(source.includes(markSnippet), `${name} should keep cloud-only compatibility helpers`);
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
  "앱 보관함 / 핸드폰 앨범 / 클라우드",
  "getStorageModeLabel(effectiveStorageMode)",
  "getEffectiveStorageMode",
  "STORAGE_MODE_OPTIONS"
]) {
  assert.ok(settingsSource.includes(snippet), `settings storage mode UI missing: ${snippet}`);
}

for (const forbidden of [
  "storageSaverUpgradeMessage",
  'option.value === "local_saver"',
  "앱 용량 절약 모드"
]) {
  assert.ok(
    !settingsSource.includes(forbidden),
    `settings storage mode UI should not include saver mode: ${forbidden}`
  );
}

for (const snippet of [
  "저장 방식",
  "getStorageModeLabel(effectiveStorageMode)",
  "getEffectiveStorageMode",
  "클라우드 백업"
]) {
  assert.ok(accountSource.includes(snippet), `account storage mode UI missing: ${snippet}`);
}

for (const source of [storageModeSource, settingsSource, accountSource]) {
  assert.ok(!source.includes("서버 백업"), "storage mode copy should say cloud backup, not server backup");
}

console.log("ok - storage mode policy exposes two clear backup choices");
