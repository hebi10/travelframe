import assert from "node:assert/strict";
import fs from "node:fs";

const entitlements = fs.readFileSync("lib/plan-entitlements.ts", "utf8");
const slots = fs.readFileSync("lib/cloud-backup-project-slots.ts", "utf8");
const account = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
const slotUi = fs.readFileSync(
  "features/account/CloudBackupProjectSlotsSection.tsx",
  "utf8"
);
const cloudBackup = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const functions = fs.readFileSync("functions/index.js", "utf8");
const billing = fs.readFileSync("lib/google-play-billing.ts", "utf8");
const admin = fs.readFileSync("admin/admin.js", "utf8");
const adminHtml = fs.readFileSync("admin/index.html", "utf8");
const firestoreRules = fs.readFileSync("firestore.rules", "utf8");

for (const token of [
  'tier: "pro"',
  "maxCloudBackupProjects: 1",
  'tier: "plus"',
  "maxCloudBackupProjects: 3",
  'tier: "expert"',
  "maxCloudBackupProjects: 5",
  "CLOUD_BACKUP_PHOTOS_PER_PROJECT = 365",
  "localImageLimit: undefined",
  "maxProgressPhotos: null"
]) {
  assert.ok(entitlements.includes(token), `plan policy missing: ${token}`);
}

for (const token of [
  "selectCloudBackupProject",
  "replaceCloudBackupProject",
  "getSelectedCloudBackupProjectIds",
  "maxSlots"
]) {
  assert.ok(
    slots.includes(token) || slotUi.includes(token),
    `backup slot client missing: ${token}`
  );
}

for (const token of [
  "백업 프로젝트는 선택 후 바로 수정할 수 없습니다",
  "클라우드 백업을 모두 삭제",
  "로컬 원본은 삭제되지 않습니다",
  "삭제 후 변경"
]) {
  assert.ok(slotUi.includes(token), `backup project warning missing: ${token}`);
}

for (const token of [
  "assertBackupProjectSlotAllowed",
  "assertProjectPhotoBackupCapacity",
  "CLOUD_BACKUP_PHOTOS_PER_PROJECT",
  "deleteBackupProjectCloudData",
  "replaceCloudBackupProject",
  "backupProjectSlots"
]) {
  assert.ok(functions.includes(token), `server slot enforcement missing: ${token}`);
}

assert.ok(
  cloudBackup.includes("getSelectedCloudBackupProjectIds") &&
    cloudBackup.includes("maxCloudBackupProjects"),
  "cloud backup must filter uploads by slots allowed by the current plan"
);

assert.ok(
  billing.includes('"plus_monthly"'),
  "Google Play billing must query the Plus subscription"
);

for (const token of [
  '"광고만 제거할까요?"',
  "광고 제거는 2,000원 1회 구매",
  "Pro는 월 1,990원 자동 갱신 구독",
  "클라우드에 프로젝트 1개"
]) {
  assert.ok(account.includes(token), `ad-removal comparison missing: ${token}`);
}

for (const token of [
  "renderBackupProjectSlots",
  "backupProjectFilterSelect",
  "backupUploadProjectSelect",
  "replaceAdminCloudBackupProject",
  "deleteAdminCloudBackupData",
  "adminPlanPolicies"
]) {
  assert.ok(admin.includes(token), `admin project-slot policy missing: ${token}`);
}

for (const token of [
  'id="backupProjectSlotList"',
  'id="currentPlanEntitlements"',
  'id="backupProjectFilterSelect"',
  'id="backupUploadProjectSelect"'
]) {
  assert.ok(adminHtml.includes(token), `admin project-slot UI missing: ${token}`);
}

for (const token of [
  "exports.replaceAdminCloudBackupProject = secureOnCall",
  "exports.deleteAdminCloudBackupData = secureOnCall",
  "syncAdminBackupProjectSlotStatuses",
  "adminBackupUploadSessions",
  "projectId: session.projectId"
]) {
  assert.ok(functions.includes(token), `admin server project-slot guard missing: ${token}`);
}

assert.ok(
  firestoreRules.includes("allow read: if isOwner(userId) || isAdmin();"),
  "admins should be able to read backed-up project metadata for project labels"
);

console.log(
  "ok - project-slot pricing, fixed backup selection, admin management, and ad-removal comparison are guarded"
);
