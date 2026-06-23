import assert from "node:assert/strict";

import { readAccountSource } from "./account-test-source.mjs";
import { readSettingsSource } from "./settings-test-source.mjs";

const accountSource = readAccountSource();
const settingsSource = readSettingsSource();

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
  assert.ok(source.includes("클라우드 백업"), `${name} should show cloud backup storage quota`);
  assert.ok(source.includes("getWeeklyVideoExportUsage"), `${name} should load weekly video usage`);
  assert.ok(source.includes("planEntitlements.backupStorageBytes"), `${name} should use the plan backup storage limit`);
  assert.ok(source.includes("formatQuotaValue"), `${name} should format used and remaining quotas`);
  assert.ok(source.includes("formatBackupStorageUsage"), `${name} should show backup storage percentage`);
}

console.log("ok - account and settings show plan quota usage");
