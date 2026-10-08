import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const { decideAdminSlotReplacement, hasReservedProjectUploads } = require("../functions/admin-backup-replacement.js");

test("admin slot replacement begins, resumes and rejects stale or overlapping swaps", () => {
  const args = { expectedProjectId: "old", projectId: "new" };
  assert.equal(decideAdminSlotReplacement({ slot: {projectId: "old", status: "active"}, ...args }), "begin");
  assert.equal(decideAdminSlotReplacement({ slot: {projectId: "old", status: "replacing", pendingProjectId: "new"}, ...args }), "resume");
  assert.equal(decideAdminSlotReplacement({ slot: {projectId: "old", status: "replacing", pendingProjectId: "different"}, ...args }), "conflict");
  assert.equal(decideAdminSlotReplacement({ slot: {projectId: "different", status: "active"}, ...args }), "conflict");
  assert.equal(decideAdminSlotReplacement({ slot: {projectId: "old", status: "over_limit"}, ...args }), "unavailable");
  assert.equal(decideAdminSlotReplacement({ slot: {projectId: "old"}, expectedProjectId: "old", projectId: "old" }), "unchanged");
});

test("reserved upload sessions stop a new slot deletion", () => {
  assert.equal(hasReservedProjectUploads([]), false);
  assert.equal(hasReservedProjectUploads([{status: "completed"}, {status: "failed"}]), false);
  assert.equal(hasReservedProjectUploads([{status: "reserved"}]), true);
});

test("replacement state persists before deletion and remains retryable", () => {
  const s = fs.readFileSync("functions/index.js","utf8");
  const a = s.indexOf("exports.replaceAdminCloudBackupProject = secureOnCall(");
  const b = s.indexOf("exports.setAdminProductSubscription = secureOnCall(",a);
  const frag = s.slice(a,b);
  assert.ok(a > 0 && b > a);
  assert.ok(frag.indexOf('status: "replacing"') < frag.indexOf("await deleteBackupProjectCloudData({"));
  assert.ok(frag.indexOf("await deleteBackupProjectCloudData({") < frag.lastIndexOf('status: "active"'));
  assert.ok(s.includes('slotSnapshot.data()?.status === "replacing"'));
});
