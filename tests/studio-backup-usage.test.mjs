import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(tabs)/studio.tsx", "utf8");

for (const snippet of [
  "subscribeCloudBackupOverview",
  "BackupUsageBadge",
  "CLOUD_BACKUP_PHOTO_LIMIT",
  "CLOUD_BACKUP_IMAGE_WORK_LIMIT",
  "CLOUD_BACKUP_VIDEO_LIMIT",
  "클라우드 백업",
  "backupOverview.photoCount",
  "backupOverview.imageBundleCount",
  "backupOverview.videoCount"
]) {
  assert.ok(source.includes(snippet), `studio backup usage missing: ${snippet}`);
}

assert.ok(
  source.includes("cloudBackupEnabled && isCreatorSubscriptionActive(subscription)"),
  "backup usage counters should only show for subscribed users with backup enabled"
);

console.log("ok - studio shows subscribed backup usage counters");
