const normalizeCount = (value) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const normalizeLimit = (value) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const normalizeWeeklyVideoExportUsage = (usage = {}, limit = usage.limit) => {
  const safeLimit = normalizeLimit(limit);
  const count = normalizeCount(usage.count);

  return {
    count,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - count)
  };
};

const buildWeeklyVideoExportReservation = ({ reservationId, userId, weekId, limit }) => ({
  reservationId,
  userId,
  weekId,
  limit: normalizeLimit(limit),
  status: "reserved"
});

const reserveWeeklyVideoExportUsage = ({ usage = {}, limit, reservationId, userId, weekId }) => {
  const normalized = normalizeWeeklyVideoExportUsage(usage, limit);
  if (normalized.count >= normalized.limit) {
    throw new Error("Weekly video export quota exceeded.");
  }

  return {
    usage: {
      count: normalized.count + 1,
      limit: normalized.limit,
      remaining: Math.max(0, normalized.limit - normalized.count - 1)
    },
    reservation: buildWeeklyVideoExportReservation({
      reservationId,
      userId,
      weekId,
      limit: normalized.limit
    })
  };
};

const completeWeeklyVideoExportReservation = ({ usage = {}, reservation }) => {
  if (!reservation || reservation.status === "released") {
    return {
      usage: normalizeWeeklyVideoExportUsage(usage, reservation?.limit ?? usage.limit),
      reservation
    };
  }

  return {
    usage: normalizeWeeklyVideoExportUsage(usage, reservation.limit ?? usage.limit),
    reservation: {
      ...reservation,
      status: "completed"
    }
  };
};

const releaseWeeklyVideoExportReservation = ({ usage = {}, reservation }) => {
  const normalized = normalizeWeeklyVideoExportUsage(usage, reservation?.limit ?? usage.limit);
  if (!reservation || reservation.status !== "reserved") {
    return {
      usage: normalized,
      reservation
    };
  }

  const count = Math.max(0, normalized.count - 1);
  return {
    usage: {
      count,
      limit: normalized.limit,
      remaining: Math.max(0, normalized.limit - count)
    },
    reservation: {
      ...reservation,
      status: "released"
    }
  };
};

exports.normalizeWeeklyVideoExportUsage = normalizeWeeklyVideoExportUsage;
exports.reserveWeeklyVideoExportUsage = reserveWeeklyVideoExportUsage;
exports.completeWeeklyVideoExportReservation = completeWeeklyVideoExportReservation;
exports.releaseWeeklyVideoExportReservation = releaseWeeklyVideoExportReservation;
