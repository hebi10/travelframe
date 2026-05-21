import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");

assert.ok(
  source.includes('getPlanEntitlements({'),
  "trip clip should derive feature access from plan entitlements"
);
assert.ok(
  source.includes("weeklyVideoExportLimit"),
  "trip clip should use the current plan weekly video export limit"
);
assert.ok(
  source.includes("getWeeklyVideoExportUsage(user, weeklyVideoExportLimit)"),
  "trip clip should load weekly usage with the plan limit"
);
assert.ok(
  source.includes("reserveWeeklyVideoExport(user, weeklyVideoExportLimit)"),
  "trip clip should reserve weekly MP4 exports with the plan limit"
);
assert.ok(
  source.includes("showWatermark={planEntitlements.showWatermark}"),
  "recording canvas watermark should follow plan entitlements"
);
assert.equal(
  source.includes("제한 없이"),
  false,
  "trip clip copy should not promise unlimited Pro video exports"
);

console.log("ok - trip clip uses plan entitlements for video export access");
