import assert from "node:assert/strict";
import fs from "node:fs";

const {
  collectOwnedCloudBackupStoragePaths
} = await import("../functions/backup-delete-safety.js");

const uid = "user-1";
const otherUid = "other-user";

const paths = collectOwnedCloudBackupStoragePaths({
  uid,
  photoBackups: [
    {
      storagePath: `users/${uid}/backups/photos/photo-1.jpg`,
      previewStoragePath: `users/${otherUid}/backups/photos/poisoned-preview.jpg`
    }
  ],
  imageWorks: [
    {
      storagePaths: [
        `users/${uid}/backups/image-works/work-1/0.jpg`,
        `users/${otherUid}/backups/image-works/work-1/1.jpg`,
        null
      ]
    }
  ],
  videos: [
    {
      storagePath: `users/${uid}/backups/videos/video-1.mp4`
    }
  ],
  musicTracks: [
    {
      storagePath: `users/${uid}/music/music-1.mp3`
    },
    {
      storagePath: `users/${otherUid}/music/poisoned.mp3`
    }
  ]
});

assert.deepEqual(paths, [
  `users/${uid}/backups/photos/photo-1.jpg`,
  `users/${uid}/backups/image-works/work-1/0.jpg`,
  `users/${uid}/backups/videos/video-1.mp4`,
  `users/${uid}/music/music-1.mp3`
]);

const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const deleteSection = functionsSource.slice(
  functionsSource.indexOf("exports.deleteCloudBackupData"),
  functionsSource.indexOf("// Cloud backup deletion is handled")
);

assert.ok(
  deleteSection.includes('userRef.collection("musicTracks").get()'),
  "cloud backup deletion should include user music metadata"
);
assert.ok(
  deleteSection.includes("collectOwnedCloudBackupStoragePaths"),
  "cloud backup deletion should filter server-side Storage paths by owner"
);
assert.ok(
  deleteSection.includes("musicCount: 0"),
  "cloud backup deletion overview should clear music count"
);
assert.ok(
  deleteSection.includes("videoTotalBytes: 0"),
  "cloud backup deletion should clear video storage usage bytes"
);

console.log("ok - cloud backup deletion filters owned paths and removes music data");
