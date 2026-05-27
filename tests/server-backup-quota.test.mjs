import assert from "node:assert/strict";

const quota = await import("../functions/backup-quota.js");

const activeCreatorSubscription = {
  plan: "premium",
  status: "active",
  productId: "creator_monthly",
  expiresAt: new Date(Date.now() + 60_000).toISOString()
};
const activeExpertSubscription = {
  ...activeCreatorSubscription,
  productId: "expert_monthly"
};

assert.equal(quota.getBackupQuotaLimits(activeCreatorSubscription).imageTotalBytes, 2 * 1024 * 1024 * 1024);
assert.equal(quota.getBackupQuotaLimits(activeCreatorSubscription).totalBytes, 2 * 1024 * 1024 * 1024);
assert.equal(quota.getBackupQuotaLimits(activeCreatorSubscription).videoCount, 50);
assert.equal(quota.getBackupQuotaLimits(activeExpertSubscription).imageTotalBytes, 5 * 1024 * 1024 * 1024);
assert.equal(quota.getBackupQuotaLimits(activeExpertSubscription).totalBytes, 5 * 1024 * 1024 * 1024);
assert.equal(quota.getBackupQuotaLimits(activeExpertSubscription).videoCount, 100);

assert.deepEqual(quota.normalizeBackupUsage(), {
  imageTotalBytes: 0,
  videoCount: 0,
  videoTotalBytes: 0,
  audioTotalBytes: 0
});

assert.doesNotThrow(() => {
  quota.assertBackupUploadAllowed({
    uid: "user-1",
    subscription: activeCreatorSubscription,
    usage: { imageTotalBytes: 1024, videoCount: 49, videoTotalBytes: 1024, audioTotalBytes: 0 },
    mediaKind: "image",
    fileSize: 2048,
    contentType: "image/jpeg",
    storagePath: "users/user-1/backups/photos/photo-1.jpg"
  });
});

assert.doesNotThrow(() => {
  quota.assertBackupUploadAllowed({
    uid: "user-1",
    subscription: activeExpertSubscription,
    usage: {
      imageTotalBytes: 2 * 1024 * 1024 * 1024 + 100,
      videoCount: 50,
      videoTotalBytes: 0,
      audioTotalBytes: 0
    },
    mediaKind: "video",
    fileSize: 1024,
    contentType: "video/mp4",
    storagePath: "users/user-1/backups/videos/expert-video-51.mp4"
  });
});

assert.doesNotThrow(() => {
  quota.assertBackupUploadAllowed({
    uid: "user-1",
    subscription: activeExpertSubscription,
    usage: { imageTotalBytes: 1024, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 },
    mediaKind: "image",
    fileSize: 2048,
    contentType: "image/jpeg",
    storagePath: "users/user-1/backups/photos/photo-expert.jpg"
  });
});

assert.throws(
  () =>
    quota.assertBackupUploadAllowed({
      uid: "user-1",
      subscription: null,
      usage: { imageTotalBytes: 0, videoCount: 0, audioTotalBytes: 0 },
      mediaKind: "image",
      fileSize: 2048,
      contentType: "image/jpeg",
      storagePath: "users/user-1/backups/photos/photo-1.jpg"
    }),
  /backup subscription/i
);

assert.throws(
  () =>
    quota.assertBackupUploadAllowed({
      uid: "user-1",
      subscription: activeCreatorSubscription,
      usage: { imageTotalBytes: 2 * 1024 * 1024 * 1024 - 100, videoCount: 0, audioTotalBytes: 0 },
      mediaKind: "image",
      fileSize: 101,
      contentType: "image/jpeg",
      storagePath: "users/user-1/backups/photos/photo-1.jpg"
    }),
  /image backup quota/i
);

assert.throws(
  () =>
    quota.assertBackupUploadAllowed({
      uid: "user-1",
      subscription: activeCreatorSubscription,
      usage: {
        imageTotalBytes: 2 * 1024 * 1024 * 1024 - 100,
        videoCount: 0,
        audioTotalBytes: 0,
        pendingUsage: {
          imageTotalBytes: 50,
          videoCount: 0,
          audioTotalBytes: 0
        }
      },
      mediaKind: "image",
      fileSize: 51,
      contentType: "image/jpeg",
      storagePath: "users/user-1/backups/photos/photo-pending.jpg"
    }),
  /image backup quota/i
);

assert.throws(
  () =>
    quota.assertBackupUploadAllowed({
      uid: "user-1",
      subscription: activeCreatorSubscription,
      usage: { imageTotalBytes: 0, videoCount: 50, videoTotalBytes: 0, audioTotalBytes: 0 },
      mediaKind: "video",
      fileSize: 1024,
      contentType: "video/mp4",
      storagePath: "users/user-1/backups/videos/video-1.mp4"
    }),
  /video backup quota/i
);

assert.throws(
  () =>
    quota.assertBackupUploadAllowed({
      uid: "user-1",
      subscription: activeExpertSubscription,
      usage: {
        imageTotalBytes: 5 * 1024 * 1024 * 1024,
        videoCount: 0,
        videoTotalBytes: 0,
        audioTotalBytes: 0
      },
      mediaKind: "image",
      fileSize: 1,
      contentType: "image/jpeg",
      storagePath: "users/user-1/backups/photos/expert-over.jpg"
    }),
  /image backup quota/i
);

assert.throws(
  () =>
    quota.assertBackupUploadAllowed({
      uid: "user-1",
      subscription: activeCreatorSubscription,
      usage: { imageTotalBytes: 0, videoCount: 0, audioTotalBytes: 0 },
      mediaKind: "image",
      fileSize: 1024,
      contentType: "image/gif",
      storagePath: "users/user-1/backups/photos/photo-1.gif"
    }),
  /content type/i
);

assert.throws(
  () =>
    quota.assertBackupUploadAllowed({
      uid: "user-1",
      subscription: activeCreatorSubscription,
      usage: { imageTotalBytes: 0, videoCount: 0, audioTotalBytes: 0 },
      mediaKind: "image",
      fileSize: 1024,
      contentType: "image/jpeg",
      storagePath: "users/other-user/backups/photos/photo-1.jpg"
    }),
  /storage path/i
);

assert.deepEqual(quota.getBackupUsageDelta({ mediaKind: "image", fileSize: 1234 }), {
  imageTotalBytes: 1234,
  videoCount: 0,
  videoTotalBytes: 0,
  audioTotalBytes: 0
});
assert.deepEqual(quota.getBackupUsageDelta({ mediaKind: "video", fileSize: 9999 }), {
  imageTotalBytes: 0,
  videoCount: 1,
  videoTotalBytes: 9999,
  audioTotalBytes: 0
});

assert.deepEqual(
  quota.reserveBackupUsage(
    {
      imageTotalBytes: 200,
      videoCount: 1,
      videoTotalBytes: 0,
      audioTotalBytes: 0,
      pendingUsage: { imageTotalBytes: 100, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 }
    },
    { imageTotalBytes: 50, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 }
  ),
  {
    imageTotalBytes: 200,
    videoCount: 1,
    videoTotalBytes: 0,
    audioTotalBytes: 0,
    pendingUsage: { imageTotalBytes: 150, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 }
  }
);

assert.deepEqual(
  quota.completeReservedBackupUsage(
    {
      imageTotalBytes: 200,
      videoCount: 1,
      videoTotalBytes: 0,
      audioTotalBytes: 0,
      pendingUsage: { imageTotalBytes: 150, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 }
    },
    { imageTotalBytes: 50, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 }
  ),
  {
    imageTotalBytes: 250,
    videoCount: 1,
    videoTotalBytes: 0,
    audioTotalBytes: 0,
    pendingUsage: { imageTotalBytes: 100, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 }
  }
);

assert.deepEqual(
  quota.releaseCompletedBackupUsage(
    {
      imageTotalBytes: 250,
      videoCount: 1,
      videoTotalBytes: 0,
      audioTotalBytes: 0,
      pendingUsage: { imageTotalBytes: 100, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 }
    },
    { imageTotalBytes: 50, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 }
  ),
  {
    imageTotalBytes: 200,
    videoCount: 1,
    videoTotalBytes: 0,
    audioTotalBytes: 0,
    pendingUsage: { imageTotalBytes: 100, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 }
  }
);

console.log("ok - server backup quota checks enforce subscription, path, type, and limits");
