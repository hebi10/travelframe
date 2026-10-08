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

module.exports = { decideAdminSlotReplacement, hasReservedProjectUploads };
