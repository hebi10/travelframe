import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/plan-entitlements.ts", "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, { exports });
const { PLAN_ENTITLEMENTS, GIB } = exports;
for (const [tier, maxProjects, storageGb] of [
  ["pro", 1, 2],
  ["plus", 3, 6],
  ["expert", 5, 10]
]) {
  const plan = PLAN_ENTITLEMENTS[tier];
  assert.equal(plan.maxCloudBackupProjects, maxProjects);
  assert.equal(plan.backupStorageBytes / GIB, storageGb);
  assert.equal(plan.maxCloudPhotosPerProject, 365);
}
for (const tier of ["guest", "free", "ad_remove"]) {
  assert.equal(PLAN_ENTITLEMENTS[tier].canBackupToCloud, false);
  assert.equal(PLAN_ENTITLEMENTS[tier].backupStorageBytes, 0);
}

const planUi = fs.readFileSync("features/account/PlanScreen.tsx", "utf8");
const account = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
const slots = fs.readFileSync("features/account/CloudBackupProjectSlotsSection.tsx", "utf8");
const settings = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");
const admin = fs.readFileSync("admin/admin.js", "utf8");

assert.ok(planUi.includes("계정 전체 공유"));
assert.ok(planUi.includes("선택한 프로젝트의 사진·영상·몸무게·체지방률"));
assert.ok(planUi.includes("프로젝트당 사진 365장"));
assert.ok(planUi.includes("백업 슬롯 교체와 전체 클라우드 영구 삭제"));
assert.ok(account.includes("backupStorageBytes={planEntitlements.backupStorageBytes}"));
assert.ok(slots.includes("backupStorageBytes: number"));
assert.ok(slots.includes("Math.round(backupStorageBytes / (1024 * 1024 * 1024))"));
assert.ok(slots.includes("촬영 수치와 설정도 선택한 프로젝트"));
assert.ok(settings.includes("planEntitlements.backupStorageBytes / GIB"));
for (const value of ["계정 공유 용량 2GB", "계정 공유 용량 6GB", "계정 공유 용량 10GB"]) {
  assert.ok(admin.includes(value), "admin plan summary must match server quota: " + value);
}
console.log("ok - TF-CLOUD-06 app, plans, admin and quota code agree for Pro, Plus, Expert");
