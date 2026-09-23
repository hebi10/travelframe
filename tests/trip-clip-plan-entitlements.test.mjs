import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";

const source = readTripClipSource();

assert.ok(
  source.includes('getPlanEntitlements({'),
  "trip clip should derive feature access from plan entitlements"
);
assert.ok(
  source.includes("weeklyVideoExportLimit"),
  "trip clip should retain the guest weekly video export limit value"
);
assert.ok(
  source.includes("planEntitlements.canExportVideo"),
  "trip clip should use the plan video export entitlement"
);
assert.ok(
  source.includes("getGuestWeeklyVideoExportUsage(weeklyVideoExportLimit)"),
  "trip clip should load guest weekly usage locally"
);
assert.ok(
  source.includes("recordGuestWeeklyVideoExport(weeklyVideoExportLimit)"),
  "trip clip should record a successful guest MP4 export"
);
assert.ok(
  source.includes("if (isLoggedIn)") &&
    source.includes("await executeSelectedExport({ returnToVideoWorks })"),
  "logged-in users should export without a weekly reservation"
);
for (const removed of [
  "reserveWeeklyVideoExport(user, weeklyVideoExportLimit)",
  "completeWeeklyVideoExport(user, weeklyExportReservationId)",
  "releaseWeeklyVideoExport(user, weeklyExportReservationId)"
]) {
  assert.equal(
    source.includes(removed),
    false,
    `logged-in export should not use legacy weekly reservations: ${removed}`
  );
}
assert.ok(
  source.includes("showWatermark={planEntitlements.showWatermark}"),
  "recording canvas watermark should follow plan entitlements"
);

console.log("ok - trip clip applies a weekly quota only to logged-out exports");
