"use strict";

const decideSlotReplacement = ({ slot, previousProjectId, projectId }) => {
  if (!slot || !previousProjectId || !projectId || slot.projectId !== previousProjectId) {
    return "conflict";
  }
  if (slot.status === "replacing") {
    return slot.pendingProjectId === projectId ? "resume" : "conflict";
  }
  if (slot.status === "over_limit") return "unavailable";
  return previousProjectId === projectId ? "unchanged" : "begin";
};

const chooseBackupProjectSlot = (snapshots, projectId, maxSlots = snapshots.length) => {
  const existing = snapshots.find(
    (snapshot) => snapshot.exists && snapshot.data()?.projectId === projectId
  );
  if (existing) return { slot: existing, action: "existing" };
  const pending = snapshots.find(
    (snapshot) => snapshot.exists && snapshot.data()?.pendingProjectId === projectId
  );
  if (pending) return { slot: pending, action: "reserved" };
  const available = snapshots.slice(0, maxSlots).find((snapshot) => !snapshot.exists);
  return available ? { slot: available, action: "create" } : null;
};

const isBackupTargetInOtherSlot = (snapshots, slotId, projectId) =>
  snapshots.some(
    (snapshot) => snapshot.exists && snapshot.id !== slotId &&
      (snapshot.data()?.projectId === projectId ||
       snapshot.data()?.pendingProjectId === projectId)
  );

const hasBlockingUploads = (sessions, now = Date.now()) =>
  sessions.some((session) => {
    if (session?.status !== "reserved") return false;
    const expiresAt = session.expiresAt?.toMillis?.() ??
      (typeof session.expiresAt === "string"
        ? new Date(session.expiresAt).getTime()
        : null);
    return expiresAt == null || !Number.isFinite(expiresAt) || expiresAt > now;
  });

const runSlotReplacement = async ({ begin, remove, finalize }) => {
  const state = await begin();
  if (state === "unchanged") {
    return { deletedPhotoCount: 0, deletedVideoCount: 0 };
  }
  if (state !== "begin" && state !== "resume") {
    throw new Error("Invalid cloud backup replacement state");
  }
  const removed = await remove();
  await finalize();
  return removed;
};

module.exports = {
  decideSlotReplacement,
  chooseBackupProjectSlot,
  isBackupTargetInOtherSlot,
  hasBlockingUploads,
  runSlotReplacement
};
