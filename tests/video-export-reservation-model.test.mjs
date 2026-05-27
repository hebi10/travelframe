import assert from "node:assert/strict";

const quota = await import("../functions/video-export-quota.js");

const reserved = quota.reserveWeeklyVideoExportUsage({
  usage: { count: 0 },
  limit: 1,
  reservationId: "reservation-1"
});

assert.equal(reserved.usage.count, 1);
assert.equal(reserved.reservation.status, "reserved");
assert.equal(reserved.reservation.reservationId, "reservation-1");

const completed = quota.completeWeeklyVideoExportReservation({
  usage: reserved.usage,
  reservation: reserved.reservation
});
assert.equal(completed.usage.count, 1);
assert.equal(completed.reservation.status, "completed");

const completedAgain = quota.completeWeeklyVideoExportReservation({
  usage: completed.usage,
  reservation: completed.reservation
});
assert.equal(completedAgain.usage.count, 1);
assert.equal(completedAgain.reservation.status, "completed");

const released = quota.releaseWeeklyVideoExportReservation({
  usage: reserved.usage,
  reservation: reserved.reservation
});
assert.equal(released.usage.count, 0);
assert.equal(released.reservation.status, "released");

const releasedAgain = quota.releaseWeeklyVideoExportReservation({
  usage: released.usage,
  reservation: released.reservation
});
assert.equal(releasedAgain.usage.count, 0);
assert.equal(releasedAgain.reservation.status, "released");

const releaseAfterComplete = quota.releaseWeeklyVideoExportReservation({
  usage: completed.usage,
  reservation: completed.reservation
});
assert.equal(releaseAfterComplete.usage.count, 1);
assert.equal(releaseAfterComplete.reservation.status, "completed");

assert.throws(
  () =>
    quota.reserveWeeklyVideoExportUsage({
      usage: { count: 1 },
      limit: 1,
      reservationId: "reservation-2"
    }),
  /quota/i
);

console.log("ok - weekly video export reservation model is idempotent");
