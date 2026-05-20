import assert from "node:assert/strict";
import fs from "node:fs";

const quota = await import("../functions/backup-quota.js");
const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const clientSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");

assert.equal(
  quota.buildBackupSessionStoragePath({
    uid: "user-1",
    sessionId: "session-abc",
    storagePath: "users/user-1/backups/photos/photo-1.jpg"
  }),
  "users/user-1/backups/photos/session-abc-photo-1.jpg"
);

assert.equal(
  quota.buildBackupSessionStoragePath({
    uid: "user-1",
    sessionId: "session-abc",
    storagePath: "users/user-1/backups/image-works/work-1/0-image.jpg"
  }),
  "users/user-1/backups/image-works/work-1/session-abc-0-image.jpg"
);

assert.equal(
  quota.buildBackupSessionStoragePath({
    uid: "user-1",
    sessionId: "session-abc",
    storagePath: "users/user-1/backups/videos/video-1.mp4"
  }),
  "users/user-1/backups/videos/session-abc-video-1.mp4"
);

assert.throws(
  () =>
    quota.buildBackupSessionStoragePath({
      uid: "user-1",
      sessionId: "session-abc",
      storagePath: "users/other/backups/photos/photo-1.jpg"
    }),
  /storage path/i
);

assert.ok(
  functionsSource.includes("deleteBackupSessionStorageObject"),
  "session cleanup should use metadata-checked Storage deletion"
);
assert.ok(
  functionsSource.includes("metadata.metadata?.backupSessionId !== backupSessionId"),
  "session cleanup must compare Storage metadata backupSessionId before deleting"
);
assert.ok(
  !functionsSource.includes("deleteStoragePath(session.storagePath)") &&
    !functionsSource.includes("deleteStoragePath(sessionToDelete.storagePath)"),
  "session cleanup must not directly delete session.storagePath"
);

assert.ok(
  clientSource.includes("const uploadStoragePath = reservation.storagePath"),
  "client uploads must use the server-generated session storage path"
);
assert.ok(
  clientSource.includes("storagePath: upload.storagePath"),
  "backup metadata must persist the actual server-generated Storage path"
);

console.log("ok - backup session storage paths are unique and cleanup is metadata-checked");
