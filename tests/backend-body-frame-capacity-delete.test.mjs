import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
const uid = "owner";
const projectId = "project";
const timestamp = (millis) => ({ toMillis: () => millis });

// Execute the production callable bodies with only Firestore/Storage replaced.
const harness = () => {
  const versions = new Map();
  const docs = new class extends Map {
    set(path, value) { versions.set(path, (versions.get(path) ?? 0) + 1); return super.set(path, value); }
    delete(path) { versions.set(path, (versions.get(path) ?? 0) + 1); return super.delete(path); }
  }();
  const objects = new Map();
  const deletes = [];
  const events = [];
  let sequence = 0;
  let failingPath = null;
  let clockNow = Date.now();
  let metadataHook = null;
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clockNow])); }
    static now() { return clockNow; }
  }
  const snapshot = (path) => {
    const value = docs.get(path);
    return {
      id: path.split("/").at(-1), exists: docs.has(path), version: versions.get(path) ?? 0,
      data: () => value, ref: ref(path)
    };
  };
  const ref = (path) => ({
    path, id: path.split("/").at(-1),
    get: async () => snapshot(path),
    collection: (name) => collection(`${path}/${name}`),
    set: async (data, options) => docs.set(path, options?.merge ? { ...docs.get(path), ...data } : data)
  });
  const collection = (path, filters = [], maximum = Infinity) => ({
    path, isQuery: true,
    doc: (id = `new-${++sequence}`) => ref(`${path}/${id}`),
    where: (field, operator, value) => {
      assert.equal(operator, "==");
      return collection(path, [...filters, [field, value]], maximum);
    },
    limit: (limit) => collection(path, filters, limit),
    get: async () => {
      events.push(`query:${path}:${filters.map(([key]) => key).join(",")}`);
      const items = [...docs.keys()].filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/") && filters.every(([field, value]) => docs.get(key)[field] === value)).slice(0, maximum).map(snapshot);
      return { docs: items, size: items.length, empty: items.length === 0 };
    }
  });
  const db = {
    doc: ref, collection,
    runTransaction: async (body) => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const reads = new Map();
        const writes = [];
        const result = await body({
          get: async (target) => {
            assert.equal(writes.length, 0, "Firestore transactions require all reads before writes");
            const result = target.isQuery ? await target.get() : snapshot(target.path);
            // Deliberately no query-phantom simulation: capacity safety must have
            // an actual shared document conflict, not rely on this mock's magic.
            for (const item of target.isQuery ? result.docs : [result]) reads.set(item.ref.path, item.version);
            return result;
          },
          set: (target, data, options) => writes.push({ target, data, merge: options?.merge }),
          update: (target, data) => writes.push({ target, data, merge: true }),
          create: (target, data) => writes.push({ target, data, create: true })
        });
        await Promise.resolve();
        if ([...reads].some(([path, version]) => (versions.get(path) ?? 0) !== version)) {
          events.push("transaction-retry");
          continue;
        }
        for (const { target, data, merge, create } of writes) {
          if (create) assert.equal(docs.has(target.path), false);
          events.push(`${create ? "create" : "write"}:${target.path}`);
          docs.set(target.path, merge ? { ...docs.get(target.path), ...data } : data);
        }
        return result;
      }
      throw Error("Mock transaction retry limit exceeded");
    },
    batch: () => {
      const refs = [];
      return { delete: (target) => refs.push(target), commit: async () => refs.forEach((target) => docs.delete(target.path)) };
    }
  };
  const firestore = () => db;
  firestore.FieldValue = { serverTimestamp: () => "server-now", delete: () => null };
  firestore.Timestamp = { fromMillis: timestamp };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const output = {};
  vm.runInNewContext(`${source}\nexports.testCapacity = assertProjectPhotoBackupCapacity; exports.testCleanup = cleanupExpiredBackupUploadSessions;`, {
    exports: output, process: { env: {} }, console, Date: ClockDate,
    require: (name) => {
      if (name === "firebase-functions/v2/https") return { onCall: (_, handler) => handler, HttpsError };
      if (name === "firebase-functions/v2/pubsub") return { onMessagePublished: () => null };
      if (name === "firebase-admin/app") return { initializeApp: () => ({}) };
      if (name === "firebase-admin/firestore") return {
        getFirestore: firestore, FieldValue: firestore.FieldValue, Timestamp: firestore.Timestamp
      };
      if (name === "firebase-admin/storage") return {
        getStorage: () => ({ bucket: () => ({ file: (path) => ({
          getMetadata: async () => {
            if (!objects.has(path)) throw Object.assign(new Error("missing"), { code: 404 });
            const hook = metadataHook; metadataHook = null;
            if (hook) hook();
            return [objects.get(path)];
          },
          delete: async () => {
            deletes.push(path);
            if (path === failingPath) throw new Error("Injected temporary Storage failure");
            if (!objects.has(path)) throw Object.assign(new Error("missing"), { code: 404 });
            objects.delete(path);
          }
        }) }) })
      };
      if (name === "./google-play-billing") return { createGooglePlayBillingService: () => ({}) };
      return require(`../functions/${name.slice(2)}`);
    }
  });
  docs.set(`users/${uid}`, {});
  docs.set(`users/${uid}/subscriptions/current`, { plan: "premium", status: "active", productId: "creator_monthly" });
  docs.set(`users/${uid}/backupProjectSlots/slot-1`, { projectId, slotNumber: 1, status: "active" });
  return {
    docs, objects, deletes, events, output,
    fail: (path) => { failingPath = path; },
    advance: (millis) => { clockNow += millis; },
    onMetadata: (hook) => { metadataHook = hook; }
  };
};

const addPhotos = (h, count = 364) => {
  for (let index = 0; index < count; index++) h.docs.set(`users/${uid}/photoBackups/p${index}`, { projectId });
};
const addSession = (h, { collection = "backupUploadSessions", id = "pending", expiresAt = timestamp(Date.now() - 1000), ...data } = {}) => {
  const path = `users/${uid}/${collection}/${id}`;
  h.docs.set(path, { userId: uid, projectId, itemType: "photo", itemId: "pending-photo", mediaKind: "image", fileSize: 100, storagePath: `users/${uid}/backups/photos/${id}/photo.jpg`, status: "reserved", expiresAt, ...data });
  return path;
};
const reserve = (h, itemId = "last-photo") => h.output.reserveBackupUpload({ auth: { uid }, data: { projectId, itemType: "photo", itemId, mediaKind: "image", fileSize: 100, contentType: "image/jpeg", storagePath: `users/${uid}/backups/photos/${itemId}.jpg` } });
const exhausted = (error) => error.code === "resource-exhausted";
const reserveAdmin = (h) => h.output.reserveAdminBackupUpload({ auth: { uid: "admin" }, data: { targetUid: uid, projectId, itemKind: "image", fileName: "photo.jpg", fileSize: 100, contentType: "image/jpeg" } });
const completeAdmin = (h, uploadSessionId) => h.output.completeAdminBackupUpload({ auth: { uid: "admin" }, data: { targetUid: uid, uploadSessionId } });
const uploadAdmin = async (h) => {
  h.docs.set("admins/admin", {});
  const reserved = await reserveAdmin(h);
  h.objects.set(reserved.storagePath, {
    size: "100", contentType: "image/jpeg", generation: "1",
    metadata: { adminBackupSessionId: reserved.uploadSessionId, firebaseStorageDownloadTokens: "test-token" }
  });
  return reserved;
};
const photoCount = (h) => [...h.docs.keys()].filter((path) => path.startsWith(`users/${uid}/photoBackups/`)).length;
const uploadOwner = async (h, itemId) => {
  const reserved = await reserve(h, itemId);
  h.objects.set(reserved.storagePath, {
    size: "100", contentType: "image/jpeg", generation: "1",
    metadata: { backupSessionId: reserved.backupSessionId, firebaseStorageDownloadTokens: "test-token" }
  });
  return { ...reserved, itemId };
};
const completeOwner = (h, uploaded) => h.output.completeBackupUpload({ auth: { uid }, data: { backupSessionId: uploaded.backupSessionId } });
const persistOwner = async (h, uploaded) => {
  await completeOwner(h, uploaded);
  h.docs.set(`users/${uid}/photoBackups/${uploaded.itemId}`, { projectId, backupSessionId: uploaded.backupSessionId, storagePath: uploaded.storagePath, fileSize: 100 });
};

for (const kinds of [["owner", "owner"], ["admin", "admin"], ["owner", "admin"]]) {
  test(`concurrent ${kinds.join("/")} reservations share exactly one final photo slot`, async () => {
    const h = harness(); addPhotos(h); h.docs.set("admins/admin", {});
    const results = await Promise.allSettled(kinds.map((kind, index) => kind === "owner" ? uploadOwner(h, `photo-${index}`) : uploadAdmin(h)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason.code === "resource-exhausted").length, 1);
    if (kinds[0] === kinds[1]) {
      assert.ok(h.events.includes("transaction-retry"), "a stale shared usage guard read must trigger retry");
    }
    for (let index = 0; index < results.length; index++) {
      if (results[index].status !== "fulfilled") continue;
      const uploaded = results[index].value;
      if (kinds[index] === "owner") await persistOwner(h, uploaded);
      else await completeAdmin(h, uploaded.uploadSessionId);
    }
    assert.equal(photoCount(h), 365);
  });

  test(`legacy overbooked ${kinds.join("/")} completions cannot persist photo 366`, async () => {
    const h = harness(); addPhotos(h, 363); h.docs.set("admins/admin", {});
    const uploaded = [];
    for (let index = 0; index < kinds.length; index++) uploaded.push(kinds[index] === "owner" ? await uploadOwner(h, `old-${index}`) : await uploadAdmin(h));
    addPhotos(h, 364); // Represents a pre-fix pair of pending reservations.
    const results = await Promise.allSettled(kinds.map((kind, index) => kind === "owner" ? persistOwner(h, uploaded[index]) : completeAdmin(h, uploaded[index].uploadSessionId)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason.code === "resource-exhausted").length, 1);
    assert.equal(photoCount(h), 365);
  });
}

test("completed owner upload retains its photo slot before client metadata is written", async () => {
  const h = harness(); addPhotos(h);
  const uploaded = await uploadOwner(h, "waiting-for-metadata");
  await completeOwner(h, uploaded);
  h.docs.set("admins/admin", {});
  await assert.rejects(reserveAdmin(h), exhausted);
  await assert.rejects(reserve(h, "different-photo"), exhausted);
  await persistOwner(h, uploaded);
  assert.equal(photoCount(h), 365);
});

test("completed owner sessions and existing photo metadata count once, including replacements", async () => {
  const h = harness(); addPhotos(h, 363);
  const uploaded = await uploadOwner(h, "saved-photo");
  await persistOwner(h, uploaded);
  const final = await uploadAdmin(h);
  await completeAdmin(h, final.uploadSessionId);
  await reserve(h, "saved-photo");
  assert.equal(photoCount(h), 365);
});

test("owner completion rechecks expiry after Storage verification before consuming its slot", async () => {
  const h = harness(); addPhotos(h);
  const uploaded = await uploadOwner(h, "expired-during-verification");
  h.onMetadata(() => h.advance(16 * 60_000));
  await assert.rejects(completeOwner(h, uploaded), (error) => error.code === "deadline-exceeded");
  assert.equal(h.docs.get(`users/${uid}/backupUploadSessions/${uploaded.backupSessionId}`).status, "failed");
  assert.equal(h.objects.has(uploaded.storagePath), false);
});

for (const collection of ["backupUploadSessions", "adminBackupUploadSessions"]) {
  test(`364 photos plus expired ${collection} still permits the last slot`, async () => {
    const h = harness(); addPhotos(h); addSession(h, { collection });
    await h.output.testCapacity({ uid, projectId, itemId: "last-photo" });
    await reserve(h);
  });
  test(`364 photos plus live ${collection} rejects an additional photo`, async () => {
    const h = harness(); addPhotos(h); addSession(h, { collection, expiresAt: timestamp(Date.now() + 60_000) });
    await assert.rejects(reserve(h), exhausted);
  });
}

test("expired sessions beyond bounded cleanup cannot occupy photo slots", async () => {
  const h = harness(); addPhotos(h);
  for (let index = 0; index < 26; index++) addSession(h, { id: `expired-${index}` });
  await reserve(h);
  assert.equal(h.docs.get(`users/${uid}/backupUploadSessions/expired-25`).status, "reserved");
});

test("admin reservations with no itemId count against the same 365 photo cap", async () => {
  const h = harness(); addPhotos(h); h.docs.set("admins/admin", {});
  const sessionPath = addSession(h, { collection: "adminBackupUploadSessions", itemId: undefined, expiresAt: timestamp(Date.now() + 60_000) });
  await assert.rejects(reserveAdmin(h), exhausted);
  h.docs.set(sessionPath, { ...h.docs.get(sessionPath), expiresAt: timestamp(Date.now() - 1000) });
  await reserveAdmin(h);
});

test("admin reservation also cleans owner reservations before the capacity query", async () => {
  const h = harness(); addPhotos(h); h.docs.set("admins/admin", {});
  const sessionPath = addSession(h);
  await reserveAdmin(h);
  assert.equal(h.docs.get(sessionPath).status, "failed");
  assert.ok(h.events.indexOf(`write:${sessionPath}`) < h.events.indexOf(`query:users/${uid}/photoBackups:projectId`));
});

test("admin completion before expiry succeeds and completed retry after expiry preserves its file", async () => {
  const h = harness(); addPhotos(h);
  const uploaded = await uploadAdmin(h);
  const completed = await completeAdmin(h, uploaded.uploadSessionId);
  assert.equal(photoCount(h), 365);
  h.advance(16 * 60_000);
  h.docs.set(`users/${uid}/backupProjectLocks/${projectId}`, {});
  assert.deepEqual(await completeAdmin(h, uploaded.uploadSessionId), completed);
  assert.equal(h.objects.has(uploaded.storagePath), true);
  assert.equal(h.deletes.length, 0);
});

test("expired admin completion cannot create photo 366 after another upload fills the freed slot", async () => {
  const h = harness(); addPhotos(h);
  const expired = await uploadAdmin(h);
  h.advance(16 * 60_000);
  const replacement = await uploadAdmin(h);
  await completeAdmin(h, replacement.uploadSessionId);
  await assert.rejects(completeAdmin(h, expired.uploadSessionId), (error) => error.code === "deadline-exceeded");
  assert.equal(photoCount(h), 365);
  assert.equal(h.docs.get(`users/${uid}/adminBackupUploadSessions/${expired.uploadSessionId}`).status, "failed");
  assert.equal(h.objects.has(expired.storagePath), false);
  assert.equal(h.objects.has(replacement.storagePath), true);
});

test("admin completion rechecks expiry inside the lock-aware final transaction", async () => {
  const h = harness(); addPhotos(h);
  const uploaded = await uploadAdmin(h);
  h.onMetadata(() => h.advance(16 * 60_000));
  await assert.rejects(completeAdmin(h, uploaded.uploadSessionId), (error) => error.code === "deadline-exceeded");
  assert.equal(photoCount(h), 364);
  assert.equal(h.objects.has(uploaded.storagePath), false);
});

test("admin finalization still rejects a project lock appearing during file verification", async () => {
  const h = harness(); addPhotos(h);
  const uploaded = await uploadAdmin(h);
  h.onMetadata(() => h.docs.set(`users/${uid}/backupProjectLocks/${projectId}`, {}));
  await assert.rejects(completeAdmin(h, uploaded.uploadSessionId), (error) => error.code === "failed-precondition");
  assert.equal(photoCount(h), 364);
  assert.equal(h.objects.has(uploaded.storagePath), true);
  assert.equal(h.docs.get(`users/${uid}/adminBackupUploadSessions/${uploaded.uploadSessionId}`).status, "reserved");
});

test("expired admin file cleanup remains retryable after Storage failure", async () => {
  const h = harness();
  const uploaded = await uploadAdmin(h);
  h.advance(16 * 60_000); h.fail(uploaded.storagePath);
  await assert.rejects(completeAdmin(h, uploaded.uploadSessionId), (error) => error.code === "internal");
  assert.equal(h.docs.get(`users/${uid}/adminBackupUploadSessions/${uploaded.uploadSessionId}`).status, "failed");
  assert.equal(h.objects.has(uploaded.storagePath), true);
  h.fail(null);
  await assert.rejects(completeAdmin(h, uploaded.uploadSessionId), (error) => error.code === "deadline-exceeded");
  assert.equal(h.objects.has(uploaded.storagePath), false);
  assert.equal(photoCount(h), 0);
});

test("expired admin cleanup preserves a mismatched session object and paths outside the target UID", async () => {
  for (const crossUid of [false, true]) {
    const h = harness();
    const uploaded = await uploadAdmin(h);
    const path = crossUid ? "users/other/backups/photos/keep.jpg" : uploaded.storagePath;
    if (crossUid) {
      const ref = `users/${uid}/adminBackupUploadSessions/${uploaded.uploadSessionId}`;
      h.docs.set(ref, { ...h.docs.get(ref), storagePath: path });
      h.objects.set(path, h.objects.get(uploaded.storagePath));
    } else {
      h.objects.get(path).metadata.adminBackupSessionId = "different-session";
    }
    h.advance(16 * 60_000);
    await assert.rejects(completeAdmin(h, uploaded.uploadSessionId), (error) => error.code === "deadline-exceeded");
    assert.equal(h.objects.has(path), true);
    assert.equal(h.deletes.length, 0);
  }
});

test("cleanup releases pending bytes before capacity queries and preserves completed usage", async () => {
  const h = harness(); addPhotos(h);
  const sessionPath = addSession(h);
  h.docs.set(`users/${uid}/backupUsage/current`, { imageTotalBytes: 200, pendingUsage: { imageTotalBytes: 100 } });
  await reserve(h);
  assert.equal(h.docs.get(sessionPath).status, "failed");
  const capacityQuery = h.events.indexOf(`query:users/${uid}/photoBackups:projectId`);
  assert.ok(h.events.indexOf(`write:${sessionPath}`) < capacityQuery);
  assert.equal(h.docs.get(`users/${uid}/backupUsage/current`).imageTotalBytes, 200);
  assert.equal(h.docs.get(`users/${uid}/backupUsage/current`).pendingUsage.imageTotalBytes, 100);
});

test("365 real photos retain the cap while replacing an existing photo remains allowed", async () => {
  const h = harness(); addPhotos(h, 365);
  await assert.rejects(reserve(h), exhausted);
  await h.output.testCapacity({ uid, projectId, itemId: "p0" });
});

test("expired cleanup preserves an object belonging to a different upload session", async () => {
  const h = harness(); addPhotos(h);
  const sessionPath = addSession(h);
  const storagePath = h.docs.get(sessionPath).storagePath;
  h.objects.set(storagePath, { metadata: { backupSessionId: "newer-session" } });
  await reserve(h);
  assert.equal(h.docs.get(sessionPath).status, "failed");
  assert.equal(h.objects.has(storagePath), true);
  assert.equal(h.deletes.length, 0);
});

test("unknown expiry stays conservative and same item reservation is not counted twice", async () => {
  const h = harness(); addPhotos(h); addSession(h, { expiresAt: null });
  await assert.rejects(reserve(h), exhausted);
  await h.output.testCapacity({ uid, projectId, itemId: "pending-photo" });
});

test("full deletion includes orphan music documents and only owned, deduplicated Storage paths", async () => {
  const h = harness();
  const owned = `users/${uid}/music/orphan.mp3`;
  const sessionPath = addSession(h, { collection: "musicUploadSessions", storagePath: owned, status: "reserved" });
  h.docs.set(`users/${uid}/musicTracks/linked`, { storagePath: owned });
  addSession(h, { id: "duplicate", storagePath: owned });
  addSession(h, { collection: "musicUploadSessions", id: "poison", storagePath: "users/other/music/untouched.mp3" });
  h.objects.set(owned, { metadata: { musicSessionId: "pending" } });
  h.objects.set("users/other/music/untouched.mp3", {});
  h.objects.set(`users/${uid}/profile/avatar.jpg`, {});
  await h.output.deleteCloudBackupData({ auth: { uid } });
  assert.equal(h.docs.has(sessionPath), false, "orphan session document must be removed");
  assert.deepEqual(h.deletes, [owned], "linked and session references must share one deletion");
  assert.equal(h.objects.has("users/other/music/untouched.mp3"), true);
  assert.equal(h.objects.has(`users/${uid}/profile/avatar.jpg`), true);
  assert.equal(h.docs.get(`users/${uid}/backupUsage/current`).audioTotalBytes, 0);
});

test("orphan music Storage failure retains cleanup references and retry tolerates already missing objects", async () => {
  const h = harness();
  const first = `users/${uid}/music/first.mp3`;
  const second = `users/${uid}/music/second.mp3`;
  const a = addSession(h, { collection: "musicUploadSessions", id: "a", storagePath: first });
  const b = addSession(h, { collection: "musicUploadSessions", id: "b", storagePath: second });
  h.objects.set(first, {}); h.objects.set(second, {}); h.fail(second);
  await assert.rejects(h.output.deleteCloudBackupData({ auth: { uid } }), (error) => error.code === "internal");
  assert.equal(h.docs.has(a), true); assert.equal(h.docs.has(b), true);
  assert.equal(h.objects.has(first), false); assert.equal(h.objects.has(second), true);
  h.fail(null);
  await h.output.deleteCloudBackupData({ auth: { uid } });
  assert.equal(h.docs.has(a), false); assert.equal(h.docs.has(b), false);
  assert.equal(h.objects.has(second), false);
  await h.output.deleteCloudBackupData({ auth: { uid } });
});
