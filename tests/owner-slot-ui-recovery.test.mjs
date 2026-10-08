import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("replacing project slots are excluded from automatic backups and shown as retryable", () => {
  const slots = fs.readFileSync("lib/cloud-backup-project-slots.ts", "utf8");
  const ui = fs.readFileSync("features/account/CloudBackupProjectSlotsSection.tsx", "utf8");
  assert.ok(slots.includes('status: "active" | "over_limit" | "replacing"'));
  assert.ok(slots.includes('slot.status !== "replacing"'));
  assert.ok(slots.includes("pendingProjectId"));
  assert.ok(ui.includes("교체 재시도"));
  assert.ok(ui.includes("resumeReplacement(slot)"));
  assert.ok(ui.includes("await reload().catch(() => undefined)"));
});

test("backup removal also clears project replacement locks", () => {
  const server = fs.readFileSync("functions/index.js", "utf8");
  const deletion = server.slice(server.indexOf("exports.deleteCloudBackupData = secureOnCall("));
  assert.ok(deletion.includes('collection("backupProjectLocks").get()'));
  assert.ok(deletion.includes("...projectLockSnapshot.docs"));
});
