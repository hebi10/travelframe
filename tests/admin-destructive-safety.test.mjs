import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const guards = require("../functions/admin-destructive-safety.js");

test("admin cloud destruction is opt-in and disabled by default", () => {
  for (const value of [undefined, "", "false", "TRUE", "1", "yes"]) {
    assert.equal(guards.isAdminBackupDestructionEnabled(value), false);
  }
  assert.equal(guards.isAdminBackupDestructionEnabled("true"), true);
});

test("full cloud deletion requires two independent server flags", () => {
  const allowed = guards.isAdminFullBackupDeletionEnabled;
  for (const combination of [
    [undefined, undefined],
    ["true", undefined],
    [undefined, "true"],
    ["true", "false"],
    ["false", "true"],
    ["TRUE", "true"]
  ]) {
    assert.equal(allowed(...combination), false);
  }
  assert.equal(allowed("true", "true"), true);
});

test("admin operations require exact target UID confirmation", () => {
  assert.equal(guards.matchesAdminBackupTargetConfirmation("target-a", "target-a"), true);
  assert.equal(guards.matchesAdminBackupTargetConfirmation("target-a", "target-b"), false);
  assert.equal(guards.matchesAdminBackupTargetConfirmation("", ""), false);
  assert.equal(guards.matchesAdminBackupTargetConfirmation("target-a", undefined), false);
});

test("a stale backup slot cannot be replaced based on an old project ID", () => {
  assert.equal(guards.matchesAdminBackupSlotSnapshot("old-a", "old-a"), true);
  assert.equal(guards.matchesAdminBackupSlotSnapshot("old-b", "old-a"), false);
  assert.equal(guards.matchesAdminBackupSlotSnapshot(null, "old-a"), false);
});

test("UI and server use admin destruction guards on both destructive endpoints", () => {
  const source = fs.readFileSync("functions/index.js", "utf8");
  const ui = fs.readFileSync("admin/admin.js", "utf8");
  assert.equal(
    (source.match(/assertAdminBackupDestructionAuthorized\(targetUid, confirmationUid\);/g) ?? []).length,
    2
  );
  assert.ok(source.includes("decideAdminSlotReplacement({"));
  assert.ok(source.includes("bodyProjects/${projectId}"));
  assert.ok(ui.includes("expectedProjectId: slot.projectId"));
  assert.ok(ui.includes("confirmationUid"));
  assert.ok(source.includes("FUNCTIONS_ENABLE_ADMIN_FULL_BACKUP_DELETION"));
  assert.ok(source.includes("exports.getAdminBackupCapabilities = secureOnCall"));
  assert.ok(ui.includes("canDeleteAll: capabilities?.data?.canDeleteAll === true"));
});
