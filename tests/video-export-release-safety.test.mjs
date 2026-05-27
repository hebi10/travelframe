import assert from "node:assert/strict";
import fs from "node:fs";

const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const releaseSection = functionsSource.slice(
  functionsSource.indexOf("exports.releaseWeeklyVideoExport"),
  functionsSource.indexOf("const getBackupSessionUsageDelta")
);
const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");

assert.ok(
  releaseSection.includes("releaseWeeklyVideoExport"),
  "weekly video export release callable should exist for old clients"
);
assert.equal(
  releaseSection.includes("reservationId"),
  true,
  "weekly video export release should only reclaim quota for a server-created reservation"
);
assert.ok(
  releaseSection.includes('status === "reserved"'),
  "weekly video export release should only decrement reserved exports"
);
assert.equal(
  tripClipSource.includes("await releaseWeeklyVideoExport(user)"),
  false,
  "trip clip should not release weekly export quota without a reservation id"
);
assert.ok(
  tripClipSource.includes("await releaseWeeklyVideoExport(user, weeklyExportReservationId)"),
  "trip clip should release the exact reserved weekly export on MP4 failure"
);
assert.ok(
  tripClipSource.includes("await completeWeeklyVideoExport(user, weeklyExportReservationId)"),
  "trip clip should complete the exact reserved weekly export after MP4 save succeeds"
);

console.log("ok - weekly video export release is reservation-bound");
