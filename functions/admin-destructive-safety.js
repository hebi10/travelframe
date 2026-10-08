"use strict";

const isAdminBackupDestructionEnabled = (value) => value === "true";

const matchesAdminBackupTargetConfirmation = (targetUid, confirmationUid) =>
  typeof targetUid === "string" &&
  targetUid.length > 0 &&
  targetUid === confirmationUid;

const matchesAdminBackupSlotSnapshot = (actualProjectId, expectedProjectId) =>
  typeof actualProjectId === "string" &&
  actualProjectId.length > 0 &&
  actualProjectId === expectedProjectId;

module.exports = {
  isAdminBackupDestructionEnabled,
  matchesAdminBackupTargetConfirmation,
  matchesAdminBackupSlotSnapshot
};
