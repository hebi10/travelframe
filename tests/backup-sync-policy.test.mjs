import assert from "node:assert/strict";
import fs from "node:fs";

const authSource = fs.readFileSync("lib/auth-context.tsx", "utf8");
const backupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");
const capturePreviewSource = fs.readFileSync("app/capture-preview.tsx", "utf8");
const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const studioSource = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");
const userMusicSource = fs.readFileSync("lib/user-music.ts", "utf8");

for (const snippet of [
  "await ensureUserDocument(nextUser);",
  "setSubscription(await getUserSubscription(nextUser));"
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
  "클라우드 백업 데이터를 불러오면 현재 기기의 사진, 작업물, 영상 목록이 클라우드 백업 기준으로 변경됩니다. 자동 병합하지 않습니다. 계속하시겠습니까?",
  "실패한 백업 다시 시도",
  "getCloudBackupOverview",
  "restoreCloudBackupToLocal"
]) {
  assert.ok(settingsSource.includes(snippet), `settings backup choice UI missing: ${snippet}`);
}

for (const [name, source] of [
  ["capture preview", capturePreviewSource],
  ["edit", editSource],
  ["studio import", studioSource]
]) {
  assert.ok(source.includes("backupPhotoIfEnabled"), `${name} should auto-backup saved photos`);
  assert.ok(source.includes("recordBackupFailure"), `${name} should record failed auto-backups for retry`);
}

assert.ok(
  backupSource.includes("replacePhotosFromBackup") &&
    backupSource.includes("replaceImageBundleWorksFromBackup") &&
    backupSource.includes("replaceMadeVideosFromBackup"),
  "explicit cloud restore should replace local data only after user confirmation"
);

assert.ok(
  userMusicSource.includes("syncUserMusicTracks"),
  "music track sync should remain separate from photo/video backup policy"
);

console.log("ok - backup sync policy protects local data and gates cloud restore");
