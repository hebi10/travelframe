import assert from "node:assert/strict";
import fs from "node:fs";

const accountSource = [
  fs.readFileSync("app/(tabs)/account.tsx", "utf8"),
  fs.readFileSync("features/account/account-screen.helpers.ts", "utf8")
].join("\n");
const settingsSource = [
  fs.readFileSync("app/(tabs)/settings.tsx", "utf8"),
  fs.readFileSync("features/settings/settings-screen.helpers.ts", "utf8")
].join("\n");

for (const [name, source] of [
  ["account", accountSource],
  ["settings", settingsSource]
]) {
  assert.ok(source.includes('SectionBlock title="플랜 한도"'), `${name} should show a plan quota section`);
  assert.ok(
    source.includes("영상 출력 (주간 한도)"),
    `${name} should label weekly video export quota`
  );
  assert.ok(source.includes("이미지 보관함"), `${name} should show image library quota`);
  assert.ok(source.includes("영상 보관함"), `${name} should show video library quota`);
  assert.ok(source.includes("음악 보관함"), `${name} should show music library quota`);
  assert.ok(source.includes("서버 백업"), `${name} should show server backup storage quota`);
  assert.ok(source.includes("getWeeklyVideoExportUsage"), `${name} should load weekly video usage`);
  assert.ok(source.includes("planEntitlements.backupStorageBytes"), `${name} should use the plan backup storage limit`);
  assert.ok(source.includes("formatQuotaValue"), `${name} should format used and remaining quotas`);
  assert.ok(source.includes("formatBackupStorageUsage"), `${name} should show backup storage percentage`);
}

console.log("ok - account and settings show plan quota usage");
