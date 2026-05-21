const BACKUP_QUOTA_LIMITS = {
  totalBytes: 2 * 1024 * 1024 * 1024,
  imageTotalBytes: 2 * 1024 * 1024 * 1024,
  videoCount: 50,
  audioTotalBytes: 200 * 1024 * 1024,
  imageFileBytes: 20 * 1024 * 1024,
  videoFileBytes: 250 * 1024 * 1024,
  audioFileBytes: 50 * 1024 * 1024
};

const VALID_MEDIA_KINDS = new Set(["image", "video", "audio"]);

const normalizeCount = (value) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const normalizeBackupUsage = (usage = {}) => ({
  imageTotalBytes: normalizeCount(usage.imageTotalBytes),
  videoCount: normalizeCount(usage.videoCount),
  videoTotalBytes: normalizeCount(usage.videoTotalBytes),
  audioTotalBytes: normalizeCount(usage.audioTotalBytes)
});

const normalizePendingBackupUsage = (usage = {}) =>
  normalizeBackupUsage(usage.pendingUsage ?? {});

const isBackupSubscriptionActive = (subscription, now = Date.now()) => {
  if (
    !subscription ||
    subscription.plan !== "premium" ||
    subscription.status !== "active" ||
    !["creator_monthly", "expert_monthly"].includes(subscription.productId)
  ) {
    return false;
  }

  if (!subscription.expiresAt) {
    return true;
  }

  return new Date(subscription.expiresAt).getTime() > now;
};

const getBackupUsageDelta = ({ mediaKind, fileSize }) => {
  const size = normalizeCount(fileSize);
  if (mediaKind === "image") {
    return { imageTotalBytes: size, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: 0 };
  }

  if (mediaKind === "video") {
    return { imageTotalBytes: 0, videoCount: 1, videoTotalBytes: size, audioTotalBytes: 0 };
  }

  if (mediaKind === "audio") {
    return { imageTotalBytes: 0, videoCount: 0, videoTotalBytes: 0, audioTotalBytes: size };
  }

  throw new Error("Unsupported backup media kind.");
};

const addBackupUsage = (usage, delta) => ({
  imageTotalBytes: normalizeCount(usage.imageTotalBytes) + normalizeCount(delta.imageTotalBytes),
  videoCount: normalizeCount(usage.videoCount) + normalizeCount(delta.videoCount),
  videoTotalBytes: normalizeCount(usage.videoTotalBytes) + normalizeCount(delta.videoTotalBytes),
  audioTotalBytes: normalizeCount(usage.audioTotalBytes) + normalizeCount(delta.audioTotalBytes)
});

const subtractBackupUsage = (usage, delta) => ({
  imageTotalBytes: Math.max(
    0,
    normalizeCount(usage.imageTotalBytes) - normalizeCount(delta.imageTotalBytes)
  ),
  videoCount: Math.max(0, normalizeCount(usage.videoCount) - normalizeCount(delta.videoCount)),
  videoTotalBytes: Math.max(
    0,
    normalizeCount(usage.videoTotalBytes) - normalizeCount(delta.videoTotalBytes)
  ),
  audioTotalBytes: Math.max(
    0,
    normalizeCount(usage.audioTotalBytes) - normalizeCount(delta.audioTotalBytes)
  )
});

const assertBackupUsageWithinLimits = (usage) => {
  const normalizedUsage = normalizeBackupUsage(usage);
  if (normalizedUsage.imageTotalBytes > BACKUP_QUOTA_LIMITS.imageTotalBytes) {
    throw new Error("Image backup quota exceeded.");
  }

  if (normalizedUsage.videoCount > BACKUP_QUOTA_LIMITS.videoCount) {
    throw new Error("Video backup quota exceeded.");
  }

  if (normalizedUsage.audioTotalBytes > BACKUP_QUOTA_LIMITS.audioTotalBytes) {
    throw new Error("Audio backup quota exceeded.");
  }

  const totalBytes =
    normalizedUsage.imageTotalBytes +
    normalizedUsage.videoTotalBytes +
    normalizedUsage.audioTotalBytes;

  if (totalBytes > BACKUP_QUOTA_LIMITS.totalBytes) {
    throw new Error("Total backup quota exceeded.");
  }
};

const getReservedBackupUsage = (usage) =>
  addBackupUsage(normalizeBackupUsage(usage), normalizePendingBackupUsage(usage));

const reserveBackupUsage = (usage, delta) => ({
  ...normalizeBackupUsage(usage),
  pendingUsage: addBackupUsage(normalizePendingBackupUsage(usage), delta)
});

const releaseReservedBackupUsage = (usage, delta) => ({
  ...normalizeBackupUsage(usage),
  pendingUsage: subtractBackupUsage(normalizePendingBackupUsage(usage), delta)
});

const completeReservedBackupUsage = (usage, delta) => {
  const updatedUsage = {
    ...addBackupUsage(normalizeBackupUsage(usage), delta),
    pendingUsage: subtractBackupUsage(normalizePendingBackupUsage(usage), delta)
  };

  assertBackupUsageWithinLimits(updatedUsage);
  return updatedUsage;
};

const assertValidStoragePath = ({ uid, mediaKind, storagePath }) => {
  if (typeof storagePath !== "string" || storagePath.includes("..")) {
    throw new Error("Invalid backup storage path.");
  }

  const prefixByKind = {
    image: [`users/${uid}/backups/photos/`, `users/${uid}/backups/image-works/`],
    video: [`users/${uid}/backups/videos/`],
    audio: [`users/${uid}/backups/audio/`]
  };
  const allowedPrefixes = prefixByKind[mediaKind] ?? [];
  if (!allowedPrefixes.some((prefix) => storagePath.startsWith(prefix))) {
    throw new Error("Invalid backup storage path.");
  }
};

const buildBackupSessionStoragePath = ({ uid, sessionId, storagePath }) => {
  if (
    typeof uid !== "string" ||
    typeof sessionId !== "string" ||
    !sessionId ||
    typeof storagePath !== "string" ||
    storagePath.includes("..")
  ) {
    throw new Error("Invalid backup storage path.");
  }

  const directPrefixes = [
    `users/${uid}/backups/photos/`,
    `users/${uid}/backups/videos/`,
    `users/${uid}/backups/audio/`
  ];
  for (const prefix of directPrefixes) {
    if (storagePath.startsWith(prefix)) {
      const fileName = storagePath.slice(prefix.length);
      if (!fileName || fileName.includes("/")) {
        throw new Error("Invalid backup storage path.");
      }

      return `${prefix}${sessionId}-${fileName}`;
    }
  }

  const imageWorkPrefix = `users/${uid}/backups/image-works/`;
  if (storagePath.startsWith(imageWorkPrefix)) {
    const rest = storagePath.slice(imageWorkPrefix.length);
    const [workId, fileName, ...extra] = rest.split("/");
    if (!workId || !fileName || extra.length > 0) {
      throw new Error("Invalid backup storage path.");
    }

    return `${imageWorkPrefix}${workId}/${sessionId}-${fileName}`;
  }

  throw new Error("Invalid backup storage path.");
};

const assertValidContentType = ({ mediaKind, contentType }) => {
  const valid =
    (mediaKind === "image" && /^image\/(jpeg|jpg|png|webp)$/.test(contentType)) ||
    (mediaKind === "video" && contentType === "video/mp4") ||
    (mediaKind === "audio" && /^audio\/.+$/.test(contentType));

  if (!valid) {
    throw new Error("Invalid backup content type.");
  }
};

const assertValidFileSize = ({ mediaKind, fileSize }) => {
  const size = normalizeCount(fileSize);
  const maxByKind = {
    image: BACKUP_QUOTA_LIMITS.imageFileBytes,
    video: BACKUP_QUOTA_LIMITS.videoFileBytes,
    audio: BACKUP_QUOTA_LIMITS.audioFileBytes
  };

  if (size <= 0 || size > maxByKind[mediaKind]) {
    throw new Error("Invalid backup file size.");
  }
};

const assertBackupUploadAllowed = ({
  uid,
  subscription,
  usage,
  mediaKind,
  fileSize,
  contentType,
  storagePath,
  now
}) => {
  if (!isBackupSubscriptionActive(subscription, now)) {
    throw new Error("Active backup subscription is required for backup uploads.");
  }

  if (!VALID_MEDIA_KINDS.has(mediaKind)) {
    throw new Error("Unsupported backup media kind.");
  }

  assertValidStoragePath({ uid, mediaKind, storagePath });
  assertValidContentType({ mediaKind, contentType });
  assertValidFileSize({ mediaKind, fileSize });

  const nextUsage = addBackupUsage(getReservedBackupUsage(usage), getBackupUsageDelta({
    mediaKind,
    fileSize
  }));

  assertBackupUsageWithinLimits(nextUsage);
};

exports.BACKUP_QUOTA_LIMITS = BACKUP_QUOTA_LIMITS;
exports.normalizeBackupUsage = normalizeBackupUsage;
exports.normalizePendingBackupUsage = normalizePendingBackupUsage;
exports.isBackupSubscriptionActive = isBackupSubscriptionActive;
exports.getBackupUsageDelta = getBackupUsageDelta;
exports.addBackupUsage = addBackupUsage;
exports.subtractBackupUsage = subtractBackupUsage;
exports.assertBackupUsageWithinLimits = assertBackupUsageWithinLimits;
exports.getReservedBackupUsage = getReservedBackupUsage;
exports.reserveBackupUsage = reserveBackupUsage;
exports.releaseReservedBackupUsage = releaseReservedBackupUsage;
exports.completeReservedBackupUsage = completeReservedBackupUsage;
exports.assertBackupUploadAllowed = assertBackupUploadAllowed;
exports.buildBackupSessionStoragePath = buildBackupSessionStoragePath;
