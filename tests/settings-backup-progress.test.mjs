import assert from "node:assert/strict";
import fs from "node:fs";

const backupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");

for (const snippet of [
  "type BackupProgressUpdate",
  "onProgress",
  "emitBackupProgress",
  "백업할 데이터를 준비하고 있습니다.",
  "이미지를 최적화하고 있습니다.",
  "Firebase에 백업하고 있습니다.",
  "백업을 마무리하고 있습니다."
]) {
  assert.ok(backupSource.includes(snippet), `backup progress callback missing: ${snippet}`);
}

for (const snippet of [
  "backupProgress",
  "setBackupProgress",
  "backupCheckMessage",
  "백업 상태를 확인하고 있습니다.",
  "visible={isBackupSubmitting && Boolean(backupCheckMessage)}",
  "onProgress: setBackupProgress",
  "visible={isBackupSubmitting && Boolean(backupProgress)}",
  "백업 중",
  "백업 중입니다. 앱을 닫지 말고 잠시만 기다려 주세요.",
  "backupProgressTrack",
  "backupProgressFill",
  "Math.round(backupProgress.percent)"
]) {
  assert.ok(settingsSource.includes(snippet), `settings backup progress UI missing: ${snippet}`);
}

assert.ok(
  settingsSource.includes("active && themed.activeBorder") &&
    !settingsSource.includes("active && themed.activeFill"),
  "settings option selections should use border emphasis without filled text backgrounds"
);

console.log("ok - settings shows initial backup progress");
