import assert from "node:assert/strict";
import fs from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const quotaSource = fs.readFileSync("lib/video-export-quota.ts", "utf8");
const tripClipSource = readTripClipSource();

for (const token of [
  "GUEST_WEEKLY_VIDEO_EXPORT_USAGE_KEY",
  "getGuestWeeklyVideoExportUsage",
  "recordGuestWeeklyVideoExport",
  "localStorageAdapter"
]) {
  assert.ok(
    quotaSource.includes(token),
    `guest weekly video quota should persist locally via ${token}`
  );
}

assert.ok(
  tripClipSource.includes("getGuestWeeklyVideoExportUsage"),
  "trip clip should restore guest weekly export usage"
);
assert.ok(
  tripClipSource.includes("recordGuestWeeklyVideoExport"),
  "trip clip should count a guest export only after the MP4 save succeeds"
);

for (const legacyAuthenticatedQuota of [
  "recordPendingWeeklyVideoExportCompletion",
  "flushPendingWeeklyVideoExportCompletions",
  "reserveWeeklyVideoExport(user, weeklyVideoExportLimit)"
]) {
  assert.equal(
    tripClipSource.includes(legacyAuthenticatedQuota),
    false,
    `logged-in video exports should not depend on weekly quota recovery: ${legacyAuthenticatedQuota}`
  );
}

console.log("ok - guest weekly video quota persists locally without limiting logged-in exports");
