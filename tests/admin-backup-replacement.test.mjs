import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const { decideAdminSlotReplacement, hasReservedProjectUploads, executeAdminSlotReplacement } = require("../functions/admin-backup-replacement.js");

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
  assert.ok(frag.includes("executeAdminSlotReplacement({"));
  assert.ok(s.includes('slotSnapshot.data()?.status === "replacing"'));
});

test("failed Storage deletion can be resumed without losing the replacement marker", async () => {
  let slot = { projectId: "old", status: "active" };
  let deleteCalls = 0;
  const replace = () => executeAdminSlotReplacement({
    begin: async () => {
      const decision = decideAdminSlotReplacement({
        slot, expectedProjectId: "old", projectId: "new"
      });
      if (decision === "begin") {
        slot = { projectId: "old", status: "replacing", pendingProjectId: "new" };
      }
      return decision;
    },
    remove: async () => {
      deleteCalls += 1;
      if (deleteCalls === 1) {
        throw new Error("injected Storage timeout");
      }
      return { deletedPhotoCount: 3, deletedVideoCount: 1 };
    },
    finalize: async () => {
      slot = { projectId: "new", status: "active" };
    }
  });

  await assert.rejects(replace(), /injected Storage timeout/);
  assert.equal(slot.status, "replacing");
  assert.equal(slot.pendingProjectId, "new");
  const result = await replace();
  assert.equal(deleteCalls, 2);
  assert.equal(slot.projectId, "new");
  assert.equal(slot.status, "active");
  assert.equal(result.deletedPhotoCount, 3);
});

test("a failure during final slot transaction remains retryable", async () => {
  let writes = 0;
  const state = [];
  const retry = () => executeAdminSlotReplacement({
    begin: async () => state.length === 0 ? (state.push("replacing"), "begin") : "resume",
    remove: async () => ({ deletedPhotoCount: 0, deletedVideoCount: 0 }),
    finalize: async () => {
      writes += 1;
      if (writes === 1) throw new Error("injected Firestore failure");
      state.push("active");
    }
  });
  await assert.rejects(retry(), /injected Firestore failure/);
  assert.deepEqual(state, ["replacing"]);
  await retry();
  assert.deepEqual(state, ["replacing", "active"]);
});
