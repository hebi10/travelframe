import assert from "node:assert/strict";
import fs from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const releaseSection = functionsSource.slice(
  functionsSource.indexOf("exports.releaseWeeklyVideoExport"),
  functionsSource.indexOf("const getBackupSessionUsageDelta")
);
const tripClipSource = readTripClipSource();

assert.ok(
  releaseSection.includes("releaseWeeklyVideoExport"),
  "weekly video export release callable should remain for old clients"
);
assert.equal(
  releaseSection.includes("reservationId"),
  true,
  "legacy weekly quota release should remain reservation-bound"
);
assert.ok(
  releaseSection.includes('status === "reserved"'),
  "legacy weekly quota release should only decrement reserved exports"
);

for (const removedClientQuota of [
  "releaseWeeklyVideoExport(user, weeklyExportReservationId)",
  "completeWeeklyVideoExport(user, weeklyExportReservationId)",
  "weeklyExportReservationId"
]) {
  assert.equal(
    tripClipSource.includes(removedClientQuota),
    false,
    `current logged-in video export should not use server weekly reservations: ${removedClientQuota}`
  );
}

assert.ok(
  tripClipSource.includes("recordGuestWeeklyVideoExport"),
  "the current client should only count successful logged-out exports"
);

console.log("ok - legacy server releases stay safe while current quota is guest-only");
