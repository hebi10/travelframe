import assert from "node:assert/strict";
import test from "node:test";
import { cleanupDisposableStagingResources } from "../scripts/stage19-staging-cleanup.mjs";

function fixture({ userMissing = false, fileFails = false } = {}) {
  const calls = [];
  const doc = { delete: () => { calls.push("firestore"); return Promise.resolve(); } };
  const file = { delete: (options) => {
    assert.deepEqual(options, { ignoreNotFound: true });
    calls.push("storage");
    return fileFails ? Promise.reject(new Error("storage cleanup failed")) : Promise.resolve();
  } };
  const auth = { deleteUser: async (uid) => {
    assert.equal(uid, "stage19-unique");
    calls.push("auth");
    if (userMissing) throw Object.assign(new Error("not found"), { code: "auth/user-not-found" });
  } };
  const app = {};
  const deleteApp = async (value) => { assert.equal(value, app); calls.push("app"); };
  return { calls, doc, file, auth, uid: "stage19-unique", app, deleteApp };
}

test("always removes all temporary resources after partially successful setup", async () => {
  const input = fixture({ userMissing: true });
  const result = await cleanupDisposableStagingResources(input);
  assert.deepEqual(result, { passed: true, failureCount: 0 });
  assert.deepEqual(input.calls, ["firestore", "storage", "auth", "app"]);
});

test("a cleanup failure is reported without skipping other deletions", async () => {
  const input = fixture({ fileFails: true });
  const result = await cleanupDisposableStagingResources(input);
  assert.deepEqual(result, { passed: false, failureCount: 1 });
  assert.deepEqual(input.calls, ["firestore", "storage", "auth", "app"]);
});

test("synchronous cleanup exceptions do not skip remaining resources", async () => {
  const input = fixture();
  input.doc.delete = () => { input.calls.push("firestore"); throw new Error("lost connection"); };
  const result = await cleanupDisposableStagingResources(input);
  assert.deepEqual(result, { passed: false, failureCount: 1 });
  assert.deepEqual(input.calls, ["firestore", "storage", "auth", "app"]);
});
