import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { ensurePrivateStorageDownload, buildStorageDownloadUrl } = require("../functions/private-storage.js");
const session = { userId: "alice", storagePath: "users/alice/backups/photos/a.jpg", fileSize: 32, contentType: "image/jpeg", status: "reserved" };
const metadata = { size: "32", contentType: "image/jpeg", generation: "12", metageneration: "2", metadata: { backupSessionId: "session", firebaseStorageDownloadTokens: "secret", keep: "yes" } };
const calls = [];
const bucket = { name: "bucket", file(path) { return { async getMetadata() { return [metadata]; }, async setMetadata(value, options) { calls.push({ path, value, options }); return [{ ...metadata, metadata: { ...metadata.metadata, ...value.metadata } }]; } }; } };
const args = { bucket, uid: "alice", session, sessionId: "session", sessionField: "backupSessionId", metadata };
const result = await ensurePrivateStorageDownload(args);
assert.equal(calls.length, 1);
assert.deepEqual(calls[0].value, { metadata: { firebaseStorageDownloadTokens: null, privateDownload: "true" } });
assert.deepEqual(calls[0].options, { ifGenerationMatch: "12", ifMetagenerationMatch: "2" });
assert.equal(result.metadata.privateDownload, "true");
assert.equal(result.metadata.keep, "yes");
for (const invalid of [
  { uid: "bob" },
  { session: { ...session, storagePath: "users/bob/backups/photos/a.jpg" } },
  { session: { ...session, status: "released" } },
  { metadata: { ...metadata, size: "33" } },
  { metadata: { ...metadata, contentType: "video/mp4" } },
  { metadata: { ...metadata, generation: undefined } },
  { metadata: { ...metadata, metageneration: undefined } },
  { metadata: { ...metadata, metadata: { backupSessionId: "other" } } },
  { session: { ...session, status: "completed", objectGeneration: "11", privateDownload: true } },
  { session: { ...session, status: "completed", objectGeneration: "12" } }
]) await assert.rejects(ensurePrivateStorageDownload({ ...args, ...invalid }));
assert.equal(calls.length, 1, "invalid or legacy completed sessions must never mutate storage");
await ensurePrivateStorageDownload({ ...args, metadata: undefined, session: { ...session, status: "completed", privateDownload: true, objectGeneration: "12" } });
assert.equal(calls.length, 2, "private completion retry revalidates and reasserts metadata");
const music = { ...session, storagePath: "users/alice/music/a.mp3", contentType: "audio/mpeg" };
await ensurePrivateStorageDownload({ ...args, session: music, sessionField: "musicSessionId", metadata: { ...metadata, contentType: "audio/mpeg", metadata: { musicSessionId: "session" } } });
assert.equal(calls.length, 3);
await assert.rejects(ensurePrivateStorageDownload({ ...args, bucket: { file() { return { async setMetadata() { throw new Error("precondition failed"); } }; } } }), /precondition failed/);
const urlArgs = { bucketName: "bucket", storagePath: session.storagePath };
assert.equal(buildStorageDownloadUrl({ ...urlArgs, metadata: result }), "https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Falice%2Fbackups%2Fphotos%2Fa.jpg?alt=media");
assert.match(buildStorageDownloadUrl({ ...urlArgs, metadata }), /&token=secret$/);
assert.equal(buildStorageDownloadUrl({ ...urlArgs, metadata: {} }), null);
console.log("private-storage validation, retry, legacy URL tests passed");
