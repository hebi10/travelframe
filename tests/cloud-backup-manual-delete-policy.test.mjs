import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accountSource = readFileSync("features/account/AccountScreen.tsx", "utf8");
const settingsSource = readFileSync("features/settings/SettingsScreen.tsx", "utf8");
const backupSource = readFileSync("lib/cloud-backup.ts", "utf8");
const functionsSource = readFileSync("functions/index.js", "utf8");

assert.equal(
  accountSource.includes('label="삭제 예정"'),
  false,
  "account backup summary should not show automatic deletion dates"
);

assert.ok(
  accountSource.includes('label="삭제 방식"'),
  "account backup summary should describe deletion as a manual request"
);

for (const source of [accountSource, settingsSource, backupSource]) {
  assert.equal(
    source.includes("3개월 뒤 제거"),
    false,
    "cloud backup copy should not imply automatic deletion after three months"
  );
}

assert.equal(
  settingsSource.includes("cleanupExpiredBackup"),
  false,
  "settings screen should not trigger automatic expired-backup cleanup"
);

assert.equal(
  functionsSource.includes("cleanupExpiredBackups"),
  false,
  "Firebase functions should not include scheduled backup deletion"
);

assert.equal(
  functionsSource.includes("onSchedule"),
  false,
  "Firebase functions should not schedule automatic backup deletion"
);

for (const snippet of [
  "FieldValue.delete",
  "settings: FieldValue.delete()",
  "imageBundles: FieldValue.delete()",
  "videos: FieldValue.delete()",
  "backedUpAt: null",
  "deleteAfter: null"
]) {
  assert.ok(
    functionsSource.includes(snippet),
    `cloud backup deletion should clear stale overview data: ${snippet}`
  );
}

assert.ok(
  backupSource.includes("deleteCloudBackupDataCallable"),
  "client deletion should route through the server callable"
);

console.log("ok - cloud backup deletion is described and implemented as manual");
