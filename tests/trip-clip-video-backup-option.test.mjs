import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/trip-clip.tsx", "utf8");
const backupSource = readFileSync("lib/cloud-backup.ts", "utf8");

for (const snippet of [
  "shouldBackupVideoExport",
  "남은 영상 백업",
  "클라우드 백업",
  "videoBackupRemaining",
  "canBackupMoreVideos"
]) {
  assert.ok(source.includes(snippet), `trip clip video backup option missing: ${snippet}`);
}

assert.ok(
  source.includes("shouldBackupVideoExport && videoBackupTargetEnabled") &&
    source.includes("cloudBackupEnabled"),
  "video backup should require the export backup checkbox"
);

assert.ok(
  backupSource.includes("CLOUD_BACKUP_VIDEO_LIMIT"),
  "backupMadeVideo should enforce the 50-video cloud backup limit"
);

console.log("ok - trip clip video backup option is available");
