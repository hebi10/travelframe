import assert from "node:assert/strict";
import fs from "node:fs";

const authSource = fs.readFileSync("lib/auth-context.tsx", "utf8");
const backupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const capturePreviewSource = fs.readFileSync("app/capture-preview.tsx", "utf8");
const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const studioSource = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");
const userMusicSource = fs.readFileSync("lib/user-music.ts", "utf8");

for (const snippet of [
  "await ensureUserDocument(nextUser);",
  "getUserSubscriptionState(nextUser)",
  "setVerifiedSubscription(nextSubscriptionState.verifiedSubscription);",
  "setCachedSubscription(nextSubscriptionState.cachedSubscription);",
  "setSubscriptionStatus(nextSubscriptionState.subscriptionStatus);"
]) {
  assert.ok(authSource.includes(snippet), `login flow missing expected account-only step: ${snippet}`);
}

for (const forbidden of [
  "restoreCloudBackupToLocal(",
  "backupCurrentWorkspace("
]) {
  assert.ok(
    !authSource.includes(forbidden),
    `login flow must not automatically restore or back up workspace data: ${forbidden}`
  );
}

for (const snippet of [
  "getCloudBackupOverview",
  "restoreCloudBackupToLocal",
  "backupPhotoIfEnabled",
  "backupStatus",
  "sourceDeviceId",
  "lastBackedUpAt",
  "backupEnabledAt"
]) {
  assert.ok(backupSource.includes(snippet), `cloud backup policy missing: ${snippet}`);
}

for (const snippet of [
  "이 계정에 기존 백업 데이터가 있습니다. 현재 기기의 데이터를 백업하거나 기존 백업 데이터를 불러올 수 있습니다.",
  "현재 기기 데이터 백업",
  "클라우드 데이터 불러오기",
  "나중에 선택",
  "현재 기기의 데이터로 백업을 시작합니다. 기존 클라우드 백업과 중복될 수 있습니다. 계속하시겠습니까?",
  "클라우드 백업 데이터 중 현재 앱에 없는 사진, 작업물, 영상만 불러옵니다. 이미 저장된 항목은 그대로 둡니다. 계속하시겠습니까?",
  "실패한 백업 다시 시도",
  "getCloudBackupOverview",
  "restoreCloudBackupToLocal"
]) {
  assert.ok(settingsSource.includes(snippet), `settings backup choice UI missing: ${snippet}`);
}

for (const [name, source] of [
  ["camera capture", cameraSource],
  ["capture preview", capturePreviewSource],
  ["edit", editSource],
  ["studio import", studioSource]
]) {
  assert.ok(source.includes("backupPhotoIfEnabled"), `${name} should auto-backup saved photos`);
  assert.ok(source.includes("recordBackupFailure"), `${name} should record failed auto-backups for retry`);
}

const tripClipImportStart = tripClipSource.indexOf("const pickPhotosFromPreview = async () => {");
const tripClipImportEnd = tripClipSource.indexOf("const handleAddUserMusic", tripClipImportStart);
assert.ok(tripClipImportStart >= 0 && tripClipImportEnd > tripClipImportStart, "trip clip image import flow should exist");
const tripClipImportSource = tripClipSource.slice(tripClipImportStart, tripClipImportEnd);

for (const snippet of [
  "backupPhotoIfEnabled",
  "recordBackupFailure",
  'kind: "photo"'
]) {
  assert.ok(
    tripClipImportSource.includes(snippet),
    `trip clip image import should auto-backup saved photos and queue failures: ${snippet}`
  );
}

for (const snippet of [
  "const existingPhotoIds = new Set(localPhotos.map((item) => item.id));",
  "const missingPhotos = photos.filter((item) => !existingPhotoIds.has(item.id));",
  "replacePhotosFromBackup([...localPhotos, ...missingPhotos])",
  "const existingImageWorkIds = new Set(localImageWorks.map((item) => item.id));",
  "const missingImageWorks = imageWorks.filter((item) => !existingImageWorkIds.has(item.id));",
  "replaceImageBundleWorksFromBackup([...localImageWorks, ...missingImageWorks])",
  "const existingVideoIds = new Set(localVideos.map((item) => item.id));",
  "const missingVideos = videos.filter((item) => !existingVideoIds.has(item.id));",
  "replaceMadeVideosFromBackup([...localVideos, ...missingVideos])"
]) {
  assert.ok(backupSource.includes(snippet), `explicit cloud restore should import only missing local data: ${snippet}`);
}

assert.ok(
  userMusicSource.includes("syncUserMusicTracks"),
  "music track sync should remain separate from photo/video backup policy"
);

console.log("ok - backup sync policy protects local data and gates cloud restore");
