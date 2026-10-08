import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const { decideSlotReplacement, hasBlockingUploads, runSlotReplacement } =
  require("../functions/backup-slot-replacement.js");

test("owner backup replacement starts, resumes or rejects conflicts", () => {
  const args = { previousProjectId: "before", projectId: "after" };
  assert.equal(decideSlotReplacement({ slot: { projectId: "before", status: "active" }, ...args }), "begin");
  assert.equal(decideSlotReplacement({ slot: { projectId: "before", status: "replacing", pendingProjectId: "after" }, ...args }), "resume");
  assert.equal(decideSlotReplacement({ slot: { projectId: "before", status: "replacing", pendingProjectId: "else" }, ...args }), "conflict");
  assert.equal(decideSlotReplacement({ slot: { projectId: "different" }, ...args }), "conflict");
  assert.equal(decideSlotReplacement({ slot: { projectId: "before", status: "over_limit" }, ...args }), "unavailable");
  assert.equal(decideSlotReplacement({ slot: { projectId: "before" }, previousProjectId: "before", projectId: "before" }), "unchanged");
});

test("reserved backup uploads block a replacement until expired", () => {
  assert.equal(hasBlockingUploads([{ status: "completed" }, { status: "released" }]), false);
  assert.equal(hasBlockingUploads([{ status: "reserved" }]), true);
  assert.equal(hasBlockingUploads([{ status: "reserved", expiresAt: { toMillis: () => 10 } }], 100), false);
  assert.equal(hasBlockingUploads([{ status: "reserved", expiresAt: { toMillis: () => 120 } }], 100), true);
});

test("a failed Storage deletion remains restartable without claiming rollback", async () => {
  const state = { slot: { projectId: "before", status: "active" }, removeCalls: 0 };
  const execute = () => runSlotReplacement({
    begin: async () => {
      const decision = decideSlotReplacement({
        slot: state.slot, previousProjectId: "before", projectId: "after"
      });
      if (decision === "begin") {
        state.slot = { projectId: "before", status: "replacing", pendingProjectId: "after" };
      }
      return decision;
    },
    remove: async () => {
      state.removeCalls++;
      if (state.removeCalls === 1) throw Error("injected Storage partial deletion");
      return { deletedPhotoCount: 2, deletedVideoCount: 1 };
    },
    finalize: async () => { state.slot = { projectId: "after", status: "active" }; }
  });
  await assert.rejects(execute(), /injected Storage partial deletion/);
  assert.equal(state.slot.status, "replacing");
  const result = await execute();
  assert.equal(state.removeCalls, 2);
  assert.equal(state.slot.projectId, "after");
  assert.deepEqual(result, { deletedPhotoCount: 2, deletedVideoCount: 1 });
});

test("server reserves and completes uploads through the project lock", () => {
  const source = fs.readFileSync("functions/index.js", "utf8");
  const begin = source.indexOf("exports.replaceCloudBackupProject = secureOnCall(");
  const end = source.indexOf("const getKstWeekStart =", begin);
  const flow = source.slice(begin,end);
  assert.ok(begin >= 0 && end > begin);
  assert.ok(flow.indexOf('status: "replacing"') < flow.indexOf("await deleteBackupProjectCloudData({"));
  assert.ok(flow.includes('operation: "owner"'));
  assert.ok(flow.includes("tx.delete(lockRef)"));
  assert.ok(source.includes("projectLockRef ? transaction.get(projectLockRef)"));
});
