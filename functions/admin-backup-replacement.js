"use strict";

const decideAdminSlotReplacement = ({ slot, expectedProjectId, projectId }) => {
  if (!slot || !expectedProjectId || !projectId || slot.projectId !== expectedProjectId) return "conflict";
  if (slot.status === "replacing") {
    return slot.pendingProjectId === projectId ? "resume" : "conflict";
  }
  if (slot.status === "over_limit") return "unavailable";
  if (slot.projectId === projectId) return "unchanged";
  return "begin";
};

const hasReservedProjectUploads = (sessions) =>
  sessions.some((item) => item?.status === "reserved");

// Execute a durable roll-forward sequence. A thrown delete or finalize error
// intentionally leaves the slot in its "replacing" state for retry.
const executeAdminSlotReplacement = async ({ begin, remove, finalize }) => {
  const state = await begin();
  if (state === "unchanged") {
    return { deletedPhotoCount: 0, deletedVideoCount: 0 };
  }
  if (state !== "begin" && state !== "resume") {
    throw new Error("Invalid replacement state");
  }
  const deleted = await remove();
  await finalize();
  return deleted;
};

module.exports = {
  decideAdminSlotReplacement,
  hasReservedProjectUploads,
  executeAdminSlotReplacement
};
