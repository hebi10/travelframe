import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
const docs = new Map();
const deleted = [];
let deleteFailures = 0;
const snapshot = (path) => ({ exists: docs.has(path), id: path.split("/").at(-1), data: () => docs.get(path) });
const collectionSnapshot = (path) => {
  const items = [...docs.keys()].filter((key) => key.startsWith(`${path}/`)).map(snapshot);
  return { docs: items, size: items.length };
};
const collection = (path) => ({ path, collection: true, get: async () => collectionSnapshot(path), doc: (id) => ref(`${path}/${id}`) });
const ref = (path) => ({ path, get: async () => snapshot(path), collection: (name) => collection(`${path}/${name}`), set: async (data) => docs.set(path, { ...docs.get(path), ...data }) });
const db = {
  doc: ref,
  collection,
  runTransaction: async (body) => body({
    get: async (target) => target.collection === true
      ? { docs: [...docs.keys()].filter((path) => path.startsWith(`${target.path}/`)).map(snapshot) }
      : snapshot(target.path),
    set: (target, data) => docs.set(target.path, { ...docs.get(target.path), ...data }),
    update: (target, data) => docs.set(target.path, { ...docs.get(target.path), ...data })
  })
};
const firestore = () => db;
firestore.FieldValue = { serverTimestamp: () => "now" };
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const output = {};
vm.runInNewContext(`${source}\nexports.testRefreshOverview = refreshAdminBackupOverview;`, {
  exports: output, process: { env: {} }, console,
  require: (name) => {
    if (name === "firebase-functions/v2/https") return { onCall: (_, handler) => handler, HttpsError };
    if (name === "firebase-functions/v2/pubsub") return { onMessagePublished: () => null };
    if (name === "firebase-admin") return { initializeApp() {}, firestore, storage: () => ({ bucket: () => ({ file: (path) => ({ getMetadata: async () => [{ metadata: { backupSessionId: "session" }, generation: "1" }], delete: async () => {
      if (deleteFailures > 0) { deleteFailures--; throw new Error("Temporary Storage failure"); }
      deleted.push(path);
    } }) }) }) };
    if (name === "./google-play-billing") return { createGooglePlayBillingService: () => ({}) };
    return require(`../functions/${name.slice(2)}`);
  }
});
const sessionPath = "users/owner/backupUploadSessions/session";
const usagePath = "users/owner/backupUsage/current";
const storagePath = "users/owner/backups/photos/session/photo.jpg";
const reset = () => {
  docs.clear(); deleted.length = 0;
  docs.set(sessionPath, { status: "completed", storagePath, mediaKind: "image", fileSize: 100 });
  docs.set(usagePath, { imageTotalBytes: 100 });
};
reset();
await output.releaseBackupUpload({ auth: { uid: "owner" }, data: { backupSessionId: "session" } });
assert.equal(docs.get(sessionPath).status, "released");
assert.equal(docs.get(usagePath).imageTotalBytes, 0);
assert.deepEqual(deleted, [storagePath]);
reset();
docs.set("users/owner/photoBackups/photo", { backupSessionId: "session", storagePath });
await output.releaseBackupUpload({ auth: { uid: "owner" }, data: { backupSessionId: "session" } });
assert.equal(docs.get(sessionPath).status, "completed");
assert.equal(docs.get(usagePath).imageTotalBytes, 100);
assert.equal(deleted.length, 0);
docs.set("users/owner/photoBackups/photo", { storagePath, fileSize: 100, imageBackupSize: 0, optimizedSize: -1000 });
await output.testRefreshOverview("owner");
assert.equal(docs.get(usagePath).imageTotalBytes, 100, "client-editable size fields cannot lower authoritative usage");
docs.set("users/owner/backupUploadSessions/orphan", { status: "completed", storagePath: "users/owner/backups/photos/orphan.jpg", mediaKind: "image", fileSize: 25 });
await output.testRefreshOverview("owner");
assert.equal(docs.get(usagePath).imageTotalBytes, 125, "unlinked completed uploads remain counted without counting linked files twice");
docs.set(sessionPath, { ...docs.get(sessionPath), status: "released" });
docs.delete("users/owner/photoBackups/photo");
await output.testRefreshOverview("owner");
await output.releaseBackupUpload({ auth: { uid: "owner" }, data: { backupSessionId: "session" } });
assert.equal(docs.get(usagePath).imageTotalBytes, 25, "releasing an already deleted session cannot subtract another upload's usage");
reset();
deleteFailures = 1;
await assert.rejects(output.releaseBackupUpload({ auth: { uid: "owner" }, data: { backupSessionId: "session" } }), (error) => error.code === "internal");
assert.equal(docs.get(sessionPath).status, "released");
assert.equal(docs.get(usagePath).imageTotalBytes, 0);
await output.releaseBackupUpload({ auth: { uid: "owner" }, data: { backupSessionId: "session" } });
assert.deepEqual(deleted, [storagePath], "a retry must clean up Storage after the ledger release succeeded");
assert.equal(docs.get(usagePath).imageTotalBytes, 0, "cleanup retries cannot decrement usage again");
console.log("ok - orphan completion releases usage while referenced backups remain intact");
