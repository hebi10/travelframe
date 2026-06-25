const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  assertBackupUploadAllowed,
  getBackupQuotaLimits,
  getBackupUsageDelta,
  normalizeBackupUsage,
  reserveBackupUsage,
  releaseReservedBackupUsage,
  completeReservedBackupUsage,
  buildBackupSessionStoragePath
} = require("./backup-quota");
const {
  collectOwnedCloudBackupStoragePaths,
  isOwnedCloudBackupStoragePath
} = require("./backup-delete-safety");
const {
  reserveWeeklyVideoExportUsage,
  completeWeeklyVideoExportReservation,
  releaseWeeklyVideoExportReservation
} = require("./video-export-quota");

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;
// Enable only after the Android client initializes Firebase App Check.
const CALLABLE_RUNTIME_OPTIONS = process.env.FUNCTIONS_ENFORCE_APP_CHECK === "true"
  ? { enforceAppCheck: true }
  : {};
const secureOnCall = (handler) => onCall(CALLABLE_RUNTIME_OPTIONS, handler);

const toHttpsError = (error) => {
  if (error instanceof HttpsError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Backup request failed.";
  if (
    message.includes("subscription") ||
    message.includes("quota") ||
    message.includes("storage path") ||
    message.includes("content type") ||
    message.includes("file size") ||
    message.includes("media kind") ||
    message.includes("music") ||
    message.includes("Music")
  ) {
    return new HttpsError("failed-precondition", message);
  }

  return new HttpsError("internal", message);
};

const requireUid = (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Login is required for cloud backup.");
  }

  return uid;
};

const getBackupSubscription = async (uid) => {
  const [currentSnapshot, creatorSnapshot, expertSnapshot] = await Promise.all([
    db.doc(`users/${uid}/subscriptions/current`).get(),
    db.doc(`users/${uid}/subscriptions/creator_monthly`).get(),
    db.doc(`users/${uid}/subscriptions/expert_monthly`).get()
  ]);

  const current = currentSnapshot.exists ? currentSnapshot.data() : null;
  const creator = creatorSnapshot.exists ? creatorSnapshot.data() : null;
  const expert = expertSnapshot.exists ? expertSnapshot.data() : null;
  const activeExpert = isPremiumSubscriptionActive(expert, ["expert_monthly"]) ? expert : null;
  const activeCreator = isPremiumSubscriptionActive(creator, ["creator_monthly"]) ? creator : null;
  const activeCurrent = isPremiumSubscriptionActive(current, ["creator_monthly", "expert_monthly"])
    ? current
    : null;

  return activeExpert ?? activeCreator ?? activeCurrent ?? expert ?? creator ?? current;
};

const getUsageRef = (uid) => db.doc(`users/${uid}/backupUsage/current`);
const getSessionRef = (uid, sessionId) =>
  db.doc(`users/${uid}/backupUploadSessions/${sessionId}`);
const VALID_BACKUP_STATUSES = new Set([
  "none",
  "active",
  "expired",
  "deleted",
  "backed_up",
  "failed",
  "restored"
]);
const IMAGE_WORK_BACKUP_KEYS = new Set([
  "id",
  "kind",
  "title",
  "createdAt",
  "updatedAt",
  "coverUri",
  "ratio",
  "photoIds",
  "imageUris",
  "localImageUris",
  "imageWidths",
  "imageHeights",
  "userId",
  "localId",
  "storagePath",
  "storagePaths",
  "backupSessionIds",
  "optimizedImages",
  "imageBackupSize",
  "originalBackupSize",
  "imageQuality",
  "fileSize",
  "fileType",
  "backupStatus",
  "backupEnabledAt",
  "lastBackedUpAt",
  "sourceDeviceId",
  "backedUpAt"
]);
const getMusicSessionRef = (uid, sessionId) =>
  db.doc(`users/${uid}/musicUploadSessions/${sessionId}`);
const BACKUP_UPLOAD_SESSION_TTL_MS = 15 * 60 * 1000;

const MAX_USER_MUSIC_TRACKS = 20;
const MAX_PENDING_MUSIC_UPLOAD_SESSIONS = 3;
const MAX_PENDING_MUSIC_UPLOAD_BYTES = 150 * 1024 * 1024;
const MUSIC_UPLOAD_SESSION_TTL_MS = 15 * 60 * 1000;
const FREE_WEEKLY_VIDEO_EXPORT_LIMIT = 1;
const PRO_WEEKLY_VIDEO_EXPORT_LIMIT = 15;
const EXPERT_WEEKLY_VIDEO_EXPORT_LIMIT = 30;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const isPremiumSubscriptionActive = (subscription, productIds, now = Date.now()) => {
  if (
    !subscription ||
    subscription.plan !== "premium" ||
    subscription.status !== "active" ||
    !productIds.includes(subscription.productId)
  ) {
    return false;
  }

  if (!subscription.expiresAt) {
    return true;
  }

  return new Date(subscription.expiresAt).getTime() > now;
};

const getMusicTrackLimit = (subscription) => {
  if (isPremiumSubscriptionActive(subscription, ["expert_monthly"])) {
    return 20;
  }

  if (isPremiumSubscriptionActive(subscription, ["creator_monthly"])) {
    return 10;
  }

  return 0;
};

const getWeeklyVideoExportLimit = (subscription) => {
  if (isPremiumSubscriptionActive(subscription, ["expert_monthly"])) {
    return EXPERT_WEEKLY_VIDEO_EXPORT_LIMIT;
  }

  if (isPremiumSubscriptionActive(subscription, ["creator_monthly"])) {
    return PRO_WEEKLY_VIDEO_EXPORT_LIMIT;
  }

  return FREE_WEEKLY_VIDEO_EXPORT_LIMIT;
};

const getKstWeekStart = (date = new Date()) => {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  const kstDay = kstDate.getUTCDay();
  const daysFromMonday = (kstDay + 6) % 7;
  return new Date(
    Date.UTC(
      kstDate.getUTCFullYear(),
      kstDate.getUTCMonth(),
      kstDate.getUTCDate() - daysFromMonday
    )
  );
};

const getCurrentVideoExportWeek = (date = new Date()) => {
  const weekStart = getKstWeekStart(date);
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
  const format = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric"
  });

  return {
    weekId: weekStart.toISOString().slice(0, 10),
    weekLabel: `${format.format(weekStart)} - ${format.format(weekEnd)}`
  };
};

const getWeeklyVideoExportRef = (uid, weekId) =>
  db.doc(`users/${uid}/usage/videoExports/weeks/${weekId}`);
const getWeeklyVideoExportReservationRef = ({ uid, weekId, reservationId }) =>
  db.doc(`users/${uid}/usage/videoExports/weeks/${weekId}/reservations/${reservationId}`);
const createWeeklyVideoExportReservationRef = ({ uid, weekId }) =>
  getWeeklyVideoExportRef(uid, weekId).collection("reservations").doc(`${weekId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
const getWeekIdFromReservationId = (reservationId) => {
  if (typeof reservationId !== "string" || !/^\d{4}-\d{2}-\d{2}-/.test(reservationId)) {
    throw new HttpsError("invalid-argument", "A valid reservationId is required.");
  }

  return reservationId.slice(0, 10);
};
const buildWeeklyVideoExportResponse = ({ weekId, weekLabel, count, limit, reservationId }) => ({
  weekId,
  weekLabel,
  count: Math.max(0, Number(count ?? 0)),
  limit,
  remaining: Math.max(0, limit - Math.max(0, Number(count ?? 0))),
  ...(reservationId ? { reservationId } : {})
});
const ADMIN_PRODUCT_META = {
  ad_remove: {
    productName: "광고 제거",
    priceLabel: "1,990원"
  },
  creator_monthly: {
    productName: "영상 내보내기",
    priceLabel: "월 990원"
  },
  expert_monthly: {
    productName: "전문가",
    priceLabel: "월 9,900원"
  }
};
const ADMIN_PRODUCT_IDS = Object.keys(ADMIN_PRODUCT_META);
const ADMIN_SUBSCRIPTION_STATUSES = new Set(["inactive", "active", "expired"]);

const createAdminFreeSubscription = (adminUid) => ({
  plan: "free",
  productId: "free",
  status: "inactive",
  provider: "admin",
  startedAt: null,
  expiresAt: null,
  lastPaymentAt: null,
  priceLabel: "무료",
  productName: "무료",
  updatedBy: adminUid,
  updatedAt: FieldValue.serverTimestamp()
});

const getEffectiveAdminSubscription = (subscriptions) => {
  const activeExpert = isPremiumSubscriptionActive(subscriptions.expert_monthly, ["expert_monthly"])
    ? subscriptions.expert_monthly
    : null;
  const activeCreator = isPremiumSubscriptionActive(subscriptions.creator_monthly, ["creator_monthly"])
    ? subscriptions.creator_monthly
    : null;
  const activeAdRemove = isPremiumSubscriptionActive(subscriptions.ad_remove, ["ad_remove"])
    ? subscriptions.ad_remove
    : null;

  return activeExpert ?? activeCreator ?? activeAdRemove;
};

const assertMusicUploadAllowed = ({ uid, trackId, name, fileSize, contentType, storagePath }) => {
  if (typeof trackId !== "string" || !/^music-\d+/.test(trackId)) {
    throw new HttpsError("invalid-argument", "Valid trackId is required.");
  }

  if (typeof name !== "string" || !name.trim()) {
    throw new HttpsError("invalid-argument", "Music track name is required.");
  }

  if (typeof storagePath !== "string" || storagePath.includes("..")) {
    throw new HttpsError("invalid-argument", "Invalid music storage path.");
  }

  if (!storagePath.startsWith(`users/${uid}/music/`)) {
    throw new HttpsError("invalid-argument", "Invalid music storage path.");
  }

  if (typeof contentType !== "string" || !/^audio\/.+$/.test(contentType)) {
    throw new HttpsError("invalid-argument", "Invalid music content type.");
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 50 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "Invalid music file size.");
  }
};

const getMusicTrackCount = async (transaction, uid) => {
  const snapshot = await transaction.get(db.collection(`users/${uid}/musicTracks`));
  return snapshot.size;
};

const getReservedMusicUploadSummary = async (transaction, uid) => {
  const snapshot = await transaction.get(
    db.collection(`users/${uid}/musicUploadSessions`).where("status", "==", "reserved")
  );

  return snapshot.docs.reduce(
    (summary, docSnapshot) => {
      const session = docSnapshot.data();
      return {
        count: summary.count + 1,
        bytes: summary.bytes + Math.max(0, Number(session.fileSize ?? 0))
      };
    },
    { count: 0, bytes: 0 }
  );
};

const deleteMusicSessionStorageObject = async ({ storagePath, musicSessionId }) => {
  if (typeof storagePath !== "string" || !storagePath || typeof musicSessionId !== "string") {
    return;
  }

  const file = bucket.file(storagePath);
  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch (error) {
    if (error?.code === 404) {
      return;
    }

    throw error;
  }

  if (metadata.metadata?.musicSessionId !== musicSessionId) {
    return;
  }

  await file.delete().catch((error) => {
    if (error?.code !== 404) {
      throw error;
    }
  });
};

const failMusicUploadSession = async ({ uid, sessionRef, reason, objectGeneration = null }) => {
  let sessionToDelete = null;

  await db.runTransaction(async (transaction) => {
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) {
      return;
    }

    const session = sessionSnapshot.data();
    if (session.status !== "reserved") {
      return;
    }

    transaction.update(sessionRef, {
      status: "failed",
      failureReason: reason,
      failedAt: FieldValue.serverTimestamp(),
      objectGeneration
    });
    sessionToDelete = { ...session, musicSessionId: sessionSnapshot.id };
  });

  if (sessionToDelete) {
    await deleteMusicSessionStorageObject({
      storagePath: sessionToDelete.storagePath,
      musicSessionId: sessionToDelete.musicSessionId
    });
  }
};

const cleanupExpiredMusicUploadSessions = async (uid, limit = 25) => {
  const snapshot = await db
    .collection(`users/${uid}/musicUploadSessions`)
    .where("status", "==", "reserved")
    .limit(limit)
    .get();
  const now = Date.now();

  for (const docSnapshot of snapshot.docs) {
    const session = docSnapshot.data();
    if (!session.expiresAt?.toMillis || session.expiresAt.toMillis() >= now) {
      continue;
    }

    await failMusicUploadSession({
      uid,
      sessionRef: docSnapshot.ref,
      reason: "Music upload session expired before completion."
    });
  }
};

exports.reserveWeeklyVideoExport = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const subscription = await getBackupSubscription(uid);
    const limit = getWeeklyVideoExportLimit(subscription);
    const { weekId, weekLabel } = getCurrentVideoExportWeek();
    const usageRef = getWeeklyVideoExportRef(uid, weekId);
    const reservationRef = createWeeklyVideoExportReservationRef({ uid, weekId });
    let nextCount = 0;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(usageRef);
      let reserved;
      try {
        reserved = reserveWeeklyVideoExportUsage({
          usage: snapshot.data() ?? {},
          limit,
          reservationId: reservationRef.id,
          userId: uid,
          weekId
        });
      } catch (error) {
        throw new HttpsError(
          "failed-precondition",
          `이번 주에 MP4 영상을 ${limit}개까지 만들 수 있습니다. 다음 주에 다시 만들거나 플랜을 확인해 주세요.`
        );
      }

      nextCount = reserved.usage.count;
      transaction.set(
        usageRef,
        {
          userId: uid,
          weekId,
          weekLabel,
          count: nextCount,
          limit,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: snapshot.exists
            ? snapshot.data().createdAt ?? FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      transaction.set(reservationRef, {
        ...reserved.reservation,
        status: "reserved",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return buildWeeklyVideoExportResponse({
      weekId,
      weekLabel,
      count: nextCount,
      limit,
      reservationId: reservationRef.id
    });
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.releaseWeeklyVideoExport = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const subscription = await getBackupSubscription(uid);
    const limit = getWeeklyVideoExportLimit(subscription);
    const reservationId = request.data?.reservationId;
    const weekId = typeof reservationId === "string"
      ? getWeekIdFromReservationId(reservationId)
      : getCurrentVideoExportWeek().weekId;
    const { weekLabel } = getCurrentVideoExportWeek(new Date(`${weekId}T00:00:00.000Z`));
    const usageRef = getWeeklyVideoExportRef(uid, weekId);
    let nextCount = 0;

    if (typeof reservationId !== "string" || !reservationId) {
      const snapshot = await usageRef.get();
      nextCount = snapshot.exists
        ? Math.max(0, Number(snapshot.data().count ?? 0))
        : 0;
      return buildWeeklyVideoExportResponse({ weekId, weekLabel, count: nextCount, limit });
    }

    await db.runTransaction(async (transaction) => {
      const reservationRef = getWeeklyVideoExportReservationRef({ uid, weekId, reservationId });
      const [usageSnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(usageRef),
        transaction.get(reservationRef)
      ]);
      const reservation = reservationSnapshot.data();
      if (!reservationSnapshot.exists || reservation.userId !== uid) {
        throw new HttpsError("not-found", "Weekly video export reservation was not found.");
      }

      const released = releaseWeeklyVideoExportReservation({
        usage: usageSnapshot.data() ?? {},
        reservation
      });
      nextCount = released.usage.count;

      if (reservation.status === "reserved") {
        transaction.set(
          usageRef,
          {
            userId: uid,
            weekId,
            weekLabel,
            count: nextCount,
            limit,
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: usageSnapshot.exists
              ? usageSnapshot.data().createdAt ?? FieldValue.serverTimestamp()
              : FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        transaction.update(reservationRef, {
          status: "released",
          releasedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    });

    return buildWeeklyVideoExportResponse({ weekId, weekLabel, count: nextCount, limit });
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.completeWeeklyVideoExport = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const subscription = await getBackupSubscription(uid);
    const limit = getWeeklyVideoExportLimit(subscription);
    const { reservationId } = request.data ?? {};
    if (typeof reservationId !== "string" || !reservationId) {
      throw new HttpsError("invalid-argument", "reservationId is required.");
    }

    const weekId = getWeekIdFromReservationId(reservationId);
    const { weekLabel } = getCurrentVideoExportWeek(new Date(`${weekId}T00:00:00.000Z`));
    const usageRef = getWeeklyVideoExportRef(uid, weekId);
    const reservationRef = getWeeklyVideoExportReservationRef({ uid, weekId, reservationId });
    let nextCount = 0;

    await db.runTransaction(async (transaction) => {
      const [usageSnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(usageRef),
        transaction.get(reservationRef)
      ]);
      const reservation = reservationSnapshot.data();
      if (!reservationSnapshot.exists || reservation.userId !== uid) {
        throw new HttpsError("not-found", "Weekly video export reservation was not found.");
      }

      const completed = completeWeeklyVideoExportReservation({
        usage: usageSnapshot.data() ?? {},
        reservation
      });
      nextCount = completed.usage.count;

      if (reservation.status === "reserved") {
        transaction.update(reservationRef, {
          status: "completed",
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    });

    return buildWeeklyVideoExportResponse({ weekId, weekLabel, count: nextCount, limit });
  } catch (error) {
    throw toHttpsError(error);
  }
});

const getBackupSessionUsageDelta = (session) =>
  session.usageDelta ?? getBackupUsageDelta({
    mediaKind: session.mediaKind,
    fileSize: session.fileSize
  });

const deleteStoragePath = async (storagePath) => {
  if (typeof storagePath !== "string" || !storagePath) {
    return;
  }

  await bucket.file(storagePath).delete().catch((error) => {
    if (error?.code !== 404) {
      throw error;
    }
  });
};

const getDownloadUrlFromStorageMetadata = ({ storagePath, metadata }) => {
  const tokens = metadata?.metadata?.firebaseStorageDownloadTokens;
  const token = typeof tokens === "string"
    ? tokens.split(",").map((value) => value.trim()).find(Boolean)
    : null;

  if (!token || typeof storagePath !== "string" || !storagePath) {
    return null;
  }

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(token)}`;
};

const deleteOwnedCloudBackupStoragePath = async (uid, storagePath) => {
  if (!isOwnedCloudBackupStoragePath(uid, storagePath)) {
    return;
  }

  await deleteStoragePath(storagePath);
};

const deleteBackupSessionStorageObject = async ({ storagePath, backupSessionId }) => {
  if (typeof storagePath !== "string" || !storagePath || typeof backupSessionId !== "string") {
    return;
  }

  const file = bucket.file(storagePath);
  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch (error) {
    if (error?.code === 404) {
      return;
    }

    throw error;
  }

  if (metadata.metadata?.backupSessionId !== backupSessionId) {
    return;
  }

  await file.delete().catch((error) => {
    if (error?.code !== 404) {
      throw error;
    }
  });
};

const failBackupUploadSession = async ({ uid, sessionRef, reason, objectGeneration = null }) => {
  let sessionToDelete = null;

  await db.runTransaction(async (transaction) => {
    const [sessionSnapshot, usageSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(getUsageRef(uid))
    ]);
    if (!sessionSnapshot.exists) {
      return;
    }

    const session = sessionSnapshot.data();
    if (session.status !== "reserved") {
      return;
    }

    const usageDelta = getBackupSessionUsageDelta(session);
    const releasedUsage = releaseReservedBackupUsage(usageSnapshot.data(), usageDelta);
    transaction.set(
      getUsageRef(uid),
      {
        ...releasedUsage,
        pendingUsage: releasedUsage.pendingUsage,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    transaction.update(sessionRef, {
      status: "failed",
      failureReason: reason,
      failedAt: FieldValue.serverTimestamp(),
      objectGeneration
    });

    sessionToDelete = { ...session, backupSessionId: sessionSnapshot.id };
  });

  if (sessionToDelete) {
    await deleteBackupSessionStorageObject({
      storagePath: sessionToDelete.storagePath,
      backupSessionId: sessionToDelete.backupSessionId
    });
  }
};

const cleanupExpiredBackupUploadSessions = async (uid, limit = 25) => {
  const snapshot = await db
    .collection(`users/${uid}/backupUploadSessions`)
    .where("status", "==", "reserved")
    .limit(limit)
    .get();
  const now = Date.now();

  for (const docSnapshot of snapshot.docs) {
    const session = docSnapshot.data();
    if (!session.expiresAt?.toMillis || session.expiresAt.toMillis() >= now) {
      continue;
    }

    await failBackupUploadSession({
      uid,
      sessionRef: docSnapshot.ref,
      reason: "Backup upload session expired before completion."
    });
  }
};

exports.reserveBackupUpload = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { mediaKind, fileSize, contentType, storagePath } = request.data ?? {};
    const subscription = await getBackupSubscription(uid);
    await cleanupExpiredBackupUploadSessions(uid);
    const usageRef = getUsageRef(uid);
    const sessionRef = db.collection(`users/${uid}/backupUploadSessions`).doc();
    const reservedStoragePath = buildBackupSessionStoragePath({
      uid,
      sessionId: sessionRef.id,
      storagePath
    });

    await db.runTransaction(async (transaction) => {
      const usageSnapshot = await transaction.get(usageRef);
      const usage = usageSnapshot.data() ?? {};

      assertBackupUploadAllowed({
        uid,
        subscription,
        usage,
        mediaKind,
        fileSize,
        contentType,
        storagePath: reservedStoragePath
      });

      const delta = getBackupUsageDelta({ mediaKind, fileSize });
      const quotaLimits = getBackupQuotaLimits(subscription);
      const reservedUsage = reserveBackupUsage(usage, delta);
      transaction.set(sessionRef, {
        userId: uid,
        mediaKind,
        fileSize,
        contentType,
        storagePath: reservedStoragePath,
        usageDelta: delta,
        quotaLimits,
        status: "reserved",
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + BACKUP_UPLOAD_SESSION_TTL_MS)
      });
      transaction.set(
        usageRef,
        {
          ...reservedUsage,
          pendingUsage: reservedUsage.pendingUsage,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    });

    return {
      backupSessionId: sessionRef.id,
      storagePath: reservedStoragePath,
      expiresInSeconds: BACKUP_UPLOAD_SESSION_TTL_MS / 1000
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.completeBackupUpload = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { backupSessionId } = request.data ?? {};
    if (typeof backupSessionId !== "string" || !backupSessionId) {
      throw new HttpsError("invalid-argument", "backupSessionId is required.");
    }

    const sessionRef = getSessionRef(uid, backupSessionId);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists) {
      throw new HttpsError("not-found", "Backup upload session was not found.");
    }

    const session = sessionSnapshot.data();
    if (session.status === "completed") {
      return { usage: normalizeBackupUsage((await getUsageRef(uid).get()).data()) };
    }

    if (session.status !== "reserved") {
      throw new HttpsError("failed-precondition", "Backup upload session is not active.");
    }

    if (session.expiresAt?.toMillis && session.expiresAt.toMillis() < Date.now()) {
      await failBackupUploadSession({
        uid,
        sessionRef,
        reason: "Backup upload session expired before completion."
      });
      throw new HttpsError("deadline-exceeded", "Backup upload session expired.");
    }

    let metadata;
    try {
      [metadata] = await bucket.file(session.storagePath).getMetadata();
    } catch (error) {
      await failBackupUploadSession({
        uid,
        sessionRef,
        reason: "Reserved backup object was not found in Storage."
      });
      throw new HttpsError("failed-precondition", "Uploaded backup object does not match the reserved session.");
    }

    const objectSize = Number(metadata.size);
    const objectContentType = metadata.contentType;
    const objectSessionId = metadata.metadata?.backupSessionId;

    if (
      objectSize !== session.fileSize ||
      objectContentType !== session.contentType ||
      objectSessionId !== backupSessionId
    ) {
      await failBackupUploadSession({
        uid,
        sessionRef,
        reason: "Uploaded backup object does not match the reserved session.",
        objectGeneration: metadata.generation ?? null
      });
      throw new HttpsError("failed-precondition", "Uploaded backup object does not match the reserved session.");
    }

    let nextUsage;
    try {
      nextUsage = await db.runTransaction(async (transaction) => {
        const [freshSessionSnapshot, usageSnapshot] = await Promise.all([
          transaction.get(sessionRef),
          transaction.get(getUsageRef(uid))
        ]);
        const freshSession = freshSessionSnapshot.data();
        if (!freshSessionSnapshot.exists || freshSession.status !== "reserved") {
          return normalizeBackupUsage(usageSnapshot.data());
        }

        const usageDelta = getBackupSessionUsageDelta(freshSession);
        const updatedUsage = completeReservedBackupUsage(
          usageSnapshot.data(),
          usageDelta,
          freshSession.quotaLimits
        );

        transaction.set(
          getUsageRef(uid),
          {
            ...updatedUsage,
            pendingUsage: updatedUsage.pendingUsage,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        transaction.update(sessionRef, {
          status: "completed",
          completedAt: FieldValue.serverTimestamp(),
          objectGeneration: metadata.generation ?? null
        });

        return updatedUsage;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("quota")) {
        await failBackupUploadSession({
          uid,
          sessionRef,
          reason: message,
          objectGeneration: metadata.generation ?? null
        });
      }
      throw error;
    }

    return { usage: nextUsage };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.releaseBackupUpload = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { backupSessionId } = request.data ?? {};
    if (typeof backupSessionId !== "string" || !backupSessionId) {
      throw new HttpsError("invalid-argument", "backupSessionId is required.");
    }

    const sessionRef = getSessionRef(uid, backupSessionId);
    let sessionToDelete = null;
    await db.runTransaction(async (transaction) => {
      const [sessionSnapshot, usageSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(getUsageRef(uid))
      ]);
      if (!sessionSnapshot.exists) {
        return;
      }

      const session = sessionSnapshot.data();
      if (session.status !== "reserved") {
        return;
      }

      const usageDelta = getBackupSessionUsageDelta(session);
      const releasedUsage = releaseReservedBackupUsage(usageSnapshot.data(), usageDelta);
      transaction.set(
        getUsageRef(uid),
        {
          ...releasedUsage,
          pendingUsage: releasedUsage.pendingUsage,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      transaction.update(sessionRef, {
        status: "released",
        releasedAt: FieldValue.serverTimestamp()
      });
      sessionToDelete = { ...session, backupSessionId };
    });

    if (sessionToDelete) {
      await deleteBackupSessionStorageObject({
        storagePath: sessionToDelete.storagePath,
        backupSessionId
      });
    }

    return { released: Boolean(sessionToDelete) };
  } catch (error) {
    throw toHttpsError(error);
  }
});

const getStringList = (value, fieldName) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }

  const list = value.filter((item) => typeof item === "string" && item.length > 0);
  if (list.length !== value.length || new Set(list).size !== list.length) {
    throw new HttpsError("invalid-argument", `${fieldName} is invalid.`);
  }

  return list;
};

const sanitizeImageWorkBackupData = ({ uid, workId, imageWork }) => {
  if (!imageWork || typeof imageWork !== "object" || Array.isArray(imageWork)) {
    throw new HttpsError("invalid-argument", "imageWork is required.");
  }

  const keys = Object.keys(imageWork);
  const unsupportedKey = keys.find((key) => !IMAGE_WORK_BACKUP_KEYS.has(key));
  if (unsupportedKey) {
    throw new HttpsError("invalid-argument", "Unsupported image work backup field.");
  }

  if (imageWork.id && imageWork.id !== workId) {
    throw new HttpsError("invalid-argument", "Image work id does not match the path.");
  }

  if (imageWork.localId && imageWork.localId !== workId) {
    throw new HttpsError("invalid-argument", "Image work localId does not match the path.");
  }

  if (imageWork.userId && imageWork.userId !== uid) {
    throw new HttpsError("permission-denied", "Image work userId does not match the owner.");
  }

  if (!VALID_BACKUP_STATUSES.has(imageWork.backupStatus)) {
    throw new HttpsError("invalid-argument", "Invalid image work backup status.");
  }

  return Object.fromEntries(keys.map((key) => [key, imageWork[key]]));
};

const assertCompletedImageWorkSessions = async ({ uid, workId, storagePaths, backupSessionIds }) => {
  if (storagePaths.length !== backupSessionIds.length) {
    throw new HttpsError("invalid-argument", "Image work backup sessions do not match storage paths.");
  }

  const expectedPrefix = `users/${uid}/backups/image-works/${workId}/`;
  if (!storagePaths.every((storagePath) => storagePath.startsWith(expectedPrefix))) {
    throw new HttpsError("invalid-argument", "Invalid image work backup storage path.");
  }

  const snapshots = await Promise.all(
    backupSessionIds.map((sessionId) => getSessionRef(uid, sessionId).get())
  );

  const totalFileSize = snapshots.reduce((size, snapshot, index) => {
    if (!snapshot.exists) {
      throw new HttpsError("failed-precondition", "Image work backup session was not found.");
    }

    const session = snapshot.data();
    if (
      session.userId !== uid ||
      session.status !== "completed" ||
      session.mediaKind !== "image" ||
      session.storagePath !== storagePaths[index]
    ) {
      throw new HttpsError("failed-precondition", "Image work backup session is not completed for this item.");
    }

    return size + Number(session.fileSize ?? 0);
  }, 0);

  const safeImageUris = await Promise.all(
    storagePaths.map(async (storagePath, index) => {
      let metadata;
      try {
        [metadata] = await bucket.file(storagePath).getMetadata();
      } catch (error) {
        throw new HttpsError("failed-precondition", "Image work backup object was not found in Storage.");
      }

      if (metadata.metadata?.backupSessionId !== backupSessionIds[index]) {
        throw new HttpsError("failed-precondition", "Image work backup object does not match the completed session.");
      }

      const downloadUrl = getDownloadUrlFromStorageMetadata({ storagePath, metadata });
      if (!downloadUrl) {
        throw new HttpsError("failed-precondition", "Image work backup object is missing a Storage download token.");
      }

      return downloadUrl;
    })
  );

  return { totalFileSize, safeImageUris };
};

exports.completeImageWorkBackup = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { workId, imageWork } = request.data ?? {};
    if (typeof workId !== "string" || !workId) {
      throw new HttpsError("invalid-argument", "workId is required.");
    }

    const data = sanitizeImageWorkBackupData({ uid, workId, imageWork });
    const storagePaths = getStringList(data.storagePaths, "storagePaths");
    const backupSessionIds = getStringList(data.backupSessionIds, "backupSessionIds");
    const { totalFileSize, safeImageUris } = await assertCompletedImageWorkSessions({
      uid,
      workId,
      storagePaths,
      backupSessionIds
    });

    if (
      Number(data.fileSize) !== totalFileSize ||
      Number(data.imageBackupSize) !== totalFileSize
    ) {
      throw new HttpsError("failed-precondition", "Image work backup size does not match completed sessions.");
    }

    const imageWorkRef = db.doc(`users/${uid}/imageWorks/${workId}`);
    const existingSnapshot = await imageWorkRef.get();
    if (existingSnapshot.exists) {
      const existing = existingSnapshot.data();
      const storagePathsChanged =
        JSON.stringify(existing.storagePaths ?? []) !== JSON.stringify(storagePaths);
      const backupSessionIdsChanged =
        JSON.stringify(existing.backupSessionIds ?? []) !== JSON.stringify(backupSessionIds);
      if (
        existing.userId !== uid ||
        existing.localId !== workId ||
        storagePathsChanged ||
        backupSessionIdsChanged
      ) {
        throw new HttpsError("failed-precondition", "Image work backup identity fields cannot be changed.");
      }
    }

    await imageWorkRef.set({
      ...data,
      id: workId,
      userId: uid,
      localId: workId,
      imageUris: safeImageUris,
      storagePath: storagePaths[0],
      storagePaths,
      backupSessionIds,
      fileSize: totalFileSize,
      imageBackupSize: totalFileSize,
      updatedAt: FieldValue.serverTimestamp()
    });

    return { saved: true };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.reserveMusicUpload = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { trackId, name, fileSize, contentType, storagePath } = request.data ?? {};
    const subscription = await getBackupSubscription(uid);
    const musicTrackLimit = Math.min(MAX_USER_MUSIC_TRACKS, getMusicTrackLimit(subscription));

    if (musicTrackLimit <= 0) {
      throw new HttpsError("failed-precondition", "Active music subscription is required for music uploads.");
    }

    await cleanupExpiredMusicUploadSessions(uid);

    assertMusicUploadAllowed({
      uid,
      trackId,
      name,
      fileSize,
      contentType,
      storagePath
    });

    const sessionRef = db.collection(`users/${uid}/musicUploadSessions`).doc();

    await db.runTransaction(async (transaction) => {
      const [trackCount, pendingSummary] = await Promise.all([
        getMusicTrackCount(transaction, uid),
        getReservedMusicUploadSummary(transaction, uid)
      ]);
      if (trackCount >= musicTrackLimit) {
        throw new HttpsError("failed-precondition", "User music track limit exceeded.");
      }
      if (trackCount + pendingSummary.count >= musicTrackLimit) {
        throw new HttpsError("failed-precondition", "Pending music upload session limit exceeded.");
      }
      if (
        pendingSummary.count >= MAX_PENDING_MUSIC_UPLOAD_SESSIONS ||
        pendingSummary.bytes + fileSize > MAX_PENDING_MUSIC_UPLOAD_BYTES
      ) {
        throw new HttpsError("failed-precondition", "Too many pending music uploads.");
      }

      transaction.set(sessionRef, {
        userId: uid,
        trackId,
        name: name.trim(),
        fileSize,
        contentType,
        storagePath,
        musicTrackLimit,
        status: "reserved",
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + MUSIC_UPLOAD_SESSION_TTL_MS)
      });
    });

    return {
      musicSessionId: sessionRef.id,
      storagePath,
      expiresInSeconds: MUSIC_UPLOAD_SESSION_TTL_MS / 1000
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.completeMusicUpload = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { musicSessionId, trackId, name, createdAt } = request.data ?? {};
    if (typeof musicSessionId !== "string" || !musicSessionId) {
      throw new HttpsError("invalid-argument", "musicSessionId is required.");
    }

    const sessionRef = getMusicSessionRef(uid, musicSessionId);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists) {
      throw new HttpsError("not-found", "Music upload session was not found.");
    }

    const session = sessionSnapshot.data();
    if (session.status === "completed") {
      return { trackId: session.trackId };
    }

    if (session.status !== "reserved") {
      throw new HttpsError("failed-precondition", "Music upload session is not active.");
    }

    if (session.expiresAt?.toMillis && session.expiresAt.toMillis() < Date.now()) {
      await failMusicUploadSession({
        uid,
        sessionRef,
        reason: "Music upload session expired before completion."
      });
      throw new HttpsError("deadline-exceeded", "Music upload session expired.");
    }

    if (session.trackId !== trackId || session.name !== String(name ?? "").trim()) {
      throw new HttpsError("failed-precondition", "Music upload session metadata does not match.");
    }

    let metadata;
    try {
      [metadata] = await bucket.file(session.storagePath).getMetadata();
    } catch (error) {
      await failMusicUploadSession({
        uid,
        sessionRef,
        reason: "Reserved music object was not found in Storage."
      });
      throw new HttpsError("failed-precondition", "Uploaded music object does not match the reserved session.");
    }
    const objectSize = Number(metadata.size);
    const objectContentType = metadata.contentType;
    const objectSessionId = metadata.metadata?.musicSessionId;

    if (
      objectSize !== session.fileSize ||
      objectContentType !== session.contentType ||
      objectSessionId !== musicSessionId
    ) {
      await failMusicUploadSession({
        uid,
        sessionRef,
        reason: "Uploaded music object does not match the reserved session.",
        objectGeneration: metadata.generation ?? null
      });
      throw new HttpsError("failed-precondition", "Uploaded music object does not match the reserved session.");
    }

    const safeDownloadUrl = getDownloadUrlFromStorageMetadata({
      storagePath: session.storagePath,
      metadata
    });
    const safeCreatedAt =
      typeof createdAt === "string" && !Number.isNaN(new Date(createdAt).getTime())
        ? createdAt
        : new Date().toISOString();
    const trackRef = db.doc(`users/${uid}/musicTracks/${trackId}`);
    const subscription = await getBackupSubscription(uid);
    const musicTrackLimit = Math.min(MAX_USER_MUSIC_TRACKS, getMusicTrackLimit(subscription));

    await db.runTransaction(async (transaction) => {
      const [freshSessionSnapshot, existingTrackSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(trackRef)
      ]);
      const freshSession = freshSessionSnapshot.data();
      if (!freshSessionSnapshot.exists || freshSession.status !== "reserved") {
        return;
      }

      if (!existingTrackSnapshot.exists) {
        if (musicTrackLimit <= 0) {
          throw new HttpsError("failed-precondition", "Active music subscription is required for music uploads.");
        }

        const trackCount = await getMusicTrackCount(transaction, uid);
        if (trackCount >= musicTrackLimit) {
          throw new HttpsError("failed-precondition", "User music track limit exceeded.");
        }
      }

      transaction.set(trackRef, {
        id: trackId,
        userId: uid,
        name: freshSession.name,
        mimeType: freshSession.contentType,
        size: freshSession.fileSize,
        storagePath: freshSession.storagePath,
        downloadUrl: safeDownloadUrl,
        createdAt: safeCreatedAt,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.update(sessionRef, {
        status: "completed",
        completedAt: FieldValue.serverTimestamp(),
        objectGeneration: metadata.generation ?? null
      });
    });

    return { trackId };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.releaseMusicUpload = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { musicSessionId } = request.data ?? {};
    if (typeof musicSessionId !== "string" || !musicSessionId) {
      throw new HttpsError("invalid-argument", "musicSessionId is required.");
    }

    const sessionRef = getMusicSessionRef(uid, musicSessionId);
    let sessionToDelete = null;
    await db.runTransaction(async (transaction) => {
      const sessionSnapshot = await transaction.get(sessionRef);
      if (!sessionSnapshot.exists) {
        return;
      }

      const session = sessionSnapshot.data();
      if (session.status === "reserved") {
        transaction.update(sessionRef, {
          status: "released",
          releasedAt: FieldValue.serverTimestamp()
        });
        sessionToDelete = { ...session, musicSessionId };
      }
    });

    if (sessionToDelete) {
      await deleteMusicSessionStorageObject({
        storagePath: sessionToDelete.storagePath,
        musicSessionId
      });
    }

    return { released: true };
  } catch (error) {
    throw toHttpsError(error);
  }
});

const commitDeleteBatch = async (refs) => {
  for (let index = 0; index < refs.length; index += 450) {
    const batch = db.batch();
    for (const ref of refs.slice(index, index + 450)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
};

const requireAdminUid = async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) {
    throw new HttpsError("unauthenticated", "Login is required for admin backup management.");
  }

  const adminSnapshot = await db.doc(`admins/${adminUid}`).get();
  if (!adminSnapshot.exists) {
    throw new HttpsError("permission-denied", "Admin permission is required.");
  }

  return adminUid;
};

exports.setAdminProductSubscription = secureOnCall(async (request) => {
  try {
    const adminUid = await requireAdminUid(request);
    const { targetUid, productId, status, expiresAt, adminNote } = request.data ?? {};

    if (typeof targetUid !== "string" || !targetUid) {
      throw new HttpsError("invalid-argument", "targetUid is required.");
    }

    if (!ADMIN_PRODUCT_IDS.includes(productId)) {
      throw new HttpsError("invalid-argument", "Unsupported subscription product.");
    }

    if (!ADMIN_SUBSCRIPTION_STATUSES.has(status)) {
      throw new HttpsError("invalid-argument", "Unsupported subscription status.");
    }

    const targetUserSnapshot = await db.doc(`users/${targetUid}`).get();
    if (!targetUserSnapshot.exists) {
      throw new HttpsError("not-found", "Target user was not found.");
    }

    const safeExpiresAt =
      (productId === "creator_monthly" || productId === "expert_monthly") &&
      typeof expiresAt === "string" &&
      !Number.isNaN(new Date(expiresAt).getTime())
        ? expiresAt
        : null;
    const safeAdminNote = typeof adminNote === "string" && adminNote.trim()
      ? adminNote.trim()
      : null;
    const meta = ADMIN_PRODUCT_META[productId];
    const productRef = db.doc(`users/${targetUid}/subscriptions/${productId}`);
    const previousSnapshot = await productRef.get();
    const previousSubscription = previousSnapshot.exists ? previousSnapshot.data() : null;
    const nowIso = new Date().toISOString();
    const subscription = {
      plan: "premium",
      productId,
      status,
      provider: "admin",
      startedAt: previousSubscription?.startedAt ?? nowIso,
      expiresAt: safeExpiresAt,
      lastPaymentAt:
        status === "active" ? nowIso : previousSubscription?.lastPaymentAt ?? null,
      priceLabel: meta.priceLabel,
      productName: meta.productName,
      adminNote: safeAdminNote,
      updatedBy: adminUid,
      updatedAt: FieldValue.serverTimestamp()
    };

    const subscriptionRefs = Object.fromEntries(
      ADMIN_PRODUCT_IDS.map((id) => [id, db.doc(`users/${targetUid}/subscriptions/${id}`)])
    );
    const subscriptionSnapshots = await Promise.all(
      ADMIN_PRODUCT_IDS.map((id) => subscriptionRefs[id].get())
    );
    const nextSubscriptions = ADMIN_PRODUCT_IDS.reduce((items, id, index) => {
      const snapshot = subscriptionSnapshots[index];
      return {
        ...items,
        [id]: id === productId
          ? subscription
          : snapshot.exists ? snapshot.data() : null
      };
    }, {});
    const effectiveSubscription = getEffectiveAdminSubscription(nextSubscriptions);
    const batch = db.batch();

    batch.set(productRef, subscription, { merge: true });
    batch.set(
      db.doc(`users/${targetUid}/subscriptions/current`),
      {
        ...(effectiveSubscription ?? createAdminFreeSubscription(adminUid)),
        updatedBy: adminUid,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    batch.set(db.collection(`users/${targetUid}/paymentEvents`).doc(), {
      type: "admin_subscription_updated",
      productId,
      productName: meta.productName,
      priceLabel: meta.priceLabel,
      status,
      provider: "admin",
      adminUid,
      adminEmail: request.auth?.token?.email ?? null,
      note: safeAdminNote,
      createdAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    return { saved: true };
  } catch (error) {
    throw toHttpsError(error);
  }
});

const sanitizeAdminFileName = (fileName) =>
  String(fileName ?? "backup-file")
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 96) || "backup-file";

const getAdminUploadConfig = ({ targetUid, itemKind, fileName }) => {
  const safeFileName = sanitizeAdminFileName(fileName);
  if (itemKind === "image") {
    return {
      mediaKind: "image",
      itemType: "photo",
      storagePath: (sessionId) => `users/${targetUid}/backups/photos/${sessionId}-${safeFileName}`
    };
  }

  if (itemKind === "video") {
    return {
      mediaKind: "video",
      itemType: "video",
      storagePath: (sessionId) => `users/${targetUid}/backups/videos/${sessionId}-${safeFileName}`
    };
  }

  if (itemKind === "music") {
    return {
      mediaKind: "audio",
      itemType: "music",
      storagePath: (sessionId) => `users/${targetUid}/music/${sessionId}-${safeFileName}`
    };
  }

  throw new HttpsError("invalid-argument", "Unsupported admin backup item kind.");
};

const validateAdminUploadRequest = ({ targetUid, itemKind, fileName, fileSize, contentType }) => {
  if (typeof targetUid !== "string" || !targetUid) {
    throw new HttpsError("invalid-argument", "targetUid is required.");
  }

  const config = getAdminUploadConfig({ targetUid, itemKind, fileName });
  assertBackupUploadAllowed({
    uid: targetUid,
    subscription: {
      plan: "premium",
      productId: "creator_monthly",
      status: "active"
    },
    usage: {},
    mediaKind: config.mediaKind,
    fileSize,
    contentType,
    storagePath:
      config.mediaKind === "audio"
        ? `users/${targetUid}/backups/audio/${sanitizeAdminFileName(fileName)}`
        : config.storagePath("session")
  });

  return config;
};

const getBackupSnapshotsForSummary = async (uid) => {
  const userRef = db.doc(`users/${uid}`);
  const [photoSnapshot, imageWorkSnapshot, videoSnapshot, musicSnapshot] = await Promise.all([
    userRef.collection("photoBackups").get(),
    userRef.collection("imageWorks").get(),
    userRef.collection("videos").get(),
    userRef.collection("musicTracks").get()
  ]);

  return { userRef, photoSnapshot, imageWorkSnapshot, videoSnapshot, musicSnapshot };
};

const refreshAdminBackupOverview = async (uid) => {
  const { userRef, photoSnapshot, imageWorkSnapshot, videoSnapshot, musicSnapshot } =
    await getBackupSnapshotsForSummary(uid);

  let imageBackupBytes = 0;
  let videoTotalBytes = 0;
  let audioTotalBytes = 0;
  let latestBackedUpAt = null;
  const rememberLatest = (value) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return;
    if (!latestBackedUpAt || new Date(value).getTime() > new Date(latestBackedUpAt).getTime()) {
      latestBackedUpAt = value;
    }
  };

  for (const item of photoSnapshot.docs) {
    const data = item.data();
    imageBackupBytes += Number(data.imageBackupSize ?? data.optimizedSize ?? data.fileSize ?? 0);
    rememberLatest(data.backedUpAt ?? data.lastBackedUpAt ?? data.backupEnabledAt);
  }

  for (const item of imageWorkSnapshot.docs) {
    const data = item.data();
    imageBackupBytes += Number(data.imageBackupSize ?? data.fileSize ?? 0);
    rememberLatest(data.backedUpAt ?? data.lastBackedUpAt ?? data.backupEnabledAt);
  }

  for (const item of videoSnapshot.docs) {
    const data = item.data();
    videoTotalBytes += Number(data.fileSize ?? 0);
    rememberLatest(data.backedUpAt ?? data.lastBackedUpAt ?? data.createdAt);
  }

  for (const item of musicSnapshot.docs) {
    const data = item.data();
    audioTotalBytes += Number(data.size ?? data.fileSize ?? 0);
    rememberLatest(data.createdAt ?? data.updatedAt);
  }

  await Promise.all([
    userRef.collection("backups").doc("current").set(
      {
        userId: uid,
        status: photoSnapshot.size || imageWorkSnapshot.size || videoSnapshot.size || musicSnapshot.size ? "active" : "empty",
        photoCount: photoSnapshot.size,
        imageBundleCount: imageWorkSnapshot.size,
        videoCount: videoSnapshot.size,
        musicCount: musicSnapshot.size,
        imageBackupBytes,
        backedUpAt: latestBackedUpAt,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    ),
    getUsageRef(uid).set(
      {
        imageTotalBytes: imageBackupBytes,
        videoCount: videoSnapshot.size,
        videoTotalBytes,
        audioTotalBytes,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    )
  ]);

  return {
    photoCount: photoSnapshot.size,
    imageBundleCount: imageWorkSnapshot.size,
    videoCount: videoSnapshot.size,
    musicCount: musicSnapshot.size,
    imageBackupBytes
  };
};

exports.reserveAdminBackupUpload = secureOnCall(async (request) => {
  try {
    const adminUid = await requireAdminUid(request);
    const { targetUid, itemKind, fileName, fileSize, contentType } = request.data ?? {};
    const config = validateAdminUploadRequest({
      targetUid,
      itemKind,
      fileName,
      fileSize,
      contentType
    });
    const targetUserSnapshot = await db.doc(`users/${targetUid}`).get();
    if (!targetUserSnapshot.exists) {
      throw new HttpsError("not-found", "Target user was not found.");
    }
    const sessionRef = db.collection(`users/${targetUid}/adminBackupUploadSessions`).doc();
    const storagePath = config.storagePath(sessionRef.id);

    await sessionRef.set({
      adminUid,
      targetUid,
      itemKind,
      itemType: config.itemType,
      mediaKind: config.mediaKind,
      fileName: sanitizeAdminFileName(fileName),
      fileSize,
      contentType,
      storagePath,
      status: "reserved",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + BACKUP_UPLOAD_SESSION_TTL_MS)
    });

    return {
      uploadSessionId: sessionRef.id,
      storagePath,
      expiresInSeconds: BACKUP_UPLOAD_SESSION_TTL_MS / 1000
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.completeAdminBackupUpload = secureOnCall(async (request) => {
  try {
    const adminUid = await requireAdminUid(request);
    const { targetUid, uploadSessionId } = request.data ?? {};
    if (typeof targetUid !== "string" || !targetUid || typeof uploadSessionId !== "string") {
      throw new HttpsError("invalid-argument", "targetUid and uploadSessionId are required.");
    }

    const sessionRef = db.doc(`users/${targetUid}/adminBackupUploadSessions/${uploadSessionId}`);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists) {
      throw new HttpsError("not-found", "Admin upload session was not found.");
    }

    const session = sessionSnapshot.data();
    if (session.adminUid !== adminUid || session.targetUid !== targetUid) {
      throw new HttpsError("permission-denied", "Admin upload session does not belong to this request.");
    }

    if (session.status === "completed") {
      return { itemId: session.itemId, itemType: session.itemType };
    }

    if (session.status !== "reserved") {
      throw new HttpsError("failed-precondition", "Admin upload session is not active.");
    }

    const [metadata] = await bucket.file(session.storagePath).getMetadata();
    if (
      Number(metadata.size) !== Number(session.fileSize) ||
      metadata.contentType !== session.contentType ||
      metadata.metadata?.adminBackupSessionId !== uploadSessionId
    ) {
      throw new HttpsError("failed-precondition", "Uploaded admin backup file does not match the reserved session.");
    }

    const now = new Date().toISOString();
    const itemId = `${session.itemType}-${Date.now()}`;
    const safeDownloadUrl = getDownloadUrlFromStorageMetadata({
      storagePath: session.storagePath,
      metadata
    });

    if (session.itemType === "photo") {
      await db.doc(`users/${targetUid}/photoBackups/${itemId}`).set({
        id: itemId,
        userId: targetUid,
        localId: itemId,
        name: session.fileName,
        uri: safeDownloadUrl,
        downloadURL: safeDownloadUrl,
        previewUri: safeDownloadUrl,
        storagePath: session.storagePath,
        fileSize: session.fileSize,
        imageBackupSize: session.fileSize,
        fileType: session.contentType,
        backupStatus: "backed_up",
        backupEnabledAt: now,
        lastBackedUpAt: now,
        backedUpAt: now,
        sourceDeviceId: "admin",
        updatedAt: FieldValue.serverTimestamp()
      });
    } else if (session.itemType === "video") {
      await db.doc(`users/${targetUid}/videos/${itemId}`).set({
        id: itemId,
        userId: targetUid,
        localId: itemId,
        title: session.fileName,
        uri: safeDownloadUrl,
        downloadURL: safeDownloadUrl,
        storagePath: session.storagePath,
        fileSize: session.fileSize,
        fileType: session.contentType,
        backupStatus: "backed_up",
        backupEnabledAt: now,
        lastBackedUpAt: now,
        backedUpAt: now,
        sourceDeviceId: "admin",
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      await db.doc(`users/${targetUid}/musicTracks/${itemId}`).set({
        id: itemId,
        userId: targetUid,
        name: session.fileName,
        mimeType: session.contentType,
        size: session.fileSize,
        storagePath: session.storagePath,
        downloadUrl: safeDownloadUrl,
        createdAt: now,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    await sessionRef.set(
      {
        status: "completed",
        itemId,
        completedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    await refreshAdminBackupOverview(targetUid);

    return { itemId, itemType: session.itemType };
  } catch (error) {
    throw toHttpsError(error);
  }
});

const getBackupItemRef = ({ uid, itemType, itemId }) => {
  const refByType = {
    photo: db.doc(`users/${uid}/photoBackups/${itemId}`),
    imageWork: db.doc(`users/${uid}/imageWorks/${itemId}`),
    video: db.doc(`users/${uid}/videos/${itemId}`),
    music: db.doc(`users/${uid}/musicTracks/${itemId}`)
  };
  const itemRef = refByType[itemType];
  if (!itemRef) {
    throw new HttpsError("invalid-argument", "Unsupported backup item type.");
  }

  return itemRef;
};

const deleteBackupItemForUser = async ({ uid, itemType, itemId }) => {
  if (typeof itemId !== "string" || !itemId) {
    throw new HttpsError("invalid-argument", "itemId is required.");
  }

  const itemRef = getBackupItemRef({ uid, itemType, itemId });
  const snapshot = await itemRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Backup item was not found.");
  }

  const data = snapshot.data();
  const storagePaths = [
    data.storagePath,
    data.previewStoragePath,
    ...(Array.isArray(data.storagePaths) ? data.storagePaths : [])
  ].filter(Boolean);

  await Promise.all(
    storagePaths.map((storagePath) =>
      deleteOwnedCloudBackupStoragePath(uid, storagePath)
    )
  );
  await itemRef.delete();
  const summary = await refreshAdminBackupOverview(uid);

  return { deleted: true, summary };
};

exports.deleteUserBackupItem = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { itemType, itemId } = request.data ?? {};
    return await deleteBackupItemForUser({ uid, itemType, itemId });
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.deleteAdminBackupItem = secureOnCall(async (request) => {
  try {
    await requireAdminUid(request);
    const { targetUid, itemType, itemId } = request.data ?? {};
    if (typeof targetUid !== "string" || !targetUid) {
      throw new HttpsError("invalid-argument", "targetUid is required.");
    }

    return await deleteBackupItemForUser({ uid: targetUid, itemType, itemId });
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.setAdminBackupStatus = secureOnCall(async (request) => {
  try {
    await requireAdminUid(request);
    const { targetUid, status, deleteAfter } = request.data ?? {};

    if (typeof targetUid !== "string" || !targetUid) {
      throw new HttpsError("invalid-argument", "targetUid is required.");
    }

    if (!["expired", "deleted"].includes(status)) {
      throw new HttpsError("invalid-argument", "Unsupported backup status.");
    }

    const targetUserSnapshot = await db.doc(`users/${targetUid}`).get();
    if (!targetUserSnapshot.exists) {
      throw new HttpsError("not-found", "Target user was not found.");
    }

    const safeDeleteAfter =
      status === "expired" &&
      typeof deleteAfter === "string" &&
      !Number.isNaN(new Date(deleteAfter).getTime())
        ? deleteAfter
        : null;
    const payload = status === "deleted"
      ? {
          status: "deleted",
          deleteAfter: null,
          deletedAt: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp()
        }
      : {
          status: "expired",
          deleteAfter: safeDeleteAfter,
          updatedAt: FieldValue.serverTimestamp()
        };

    await db.doc(`users/${targetUid}/backups/current`).set(payload, { merge: true });
    return { status };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.deleteCloudBackupData = secureOnCall(async (request) => {
  try {
    const uid = requireUid(request);
    const userRef = db.doc(`users/${uid}`);
    const [photoSnapshot, imageWorkSnapshot, videoSnapshot, musicSnapshot] = await Promise.all([
      userRef.collection("photoBackups").get(),
      userRef.collection("imageWorks").get(),
      userRef.collection("videos").get(),
      userRef.collection("musicTracks").get()
    ]);

    let imageBackupBytes = 0;
    const documentDeletes = [];
    const storageDeletes = collectOwnedCloudBackupStoragePaths({
      uid,
      photoBackups: photoSnapshot.docs.map((item) => item.data()),
      imageWorks: imageWorkSnapshot.docs.map((item) => item.data()),
      videos: videoSnapshot.docs.map((item) => item.data()),
      musicTracks: musicSnapshot.docs.map((item) => item.data())
    }).map(deleteStoragePath);

    for (const item of photoSnapshot.docs) {
      const data = item.data();
      imageBackupBytes += Number(data.imageBackupSize ?? data.optimizedSize ?? data.fileSize ?? 0);
      documentDeletes.push(item.ref);
    }

    for (const item of imageWorkSnapshot.docs) {
      const data = item.data();
      imageBackupBytes += Number(data.imageBackupSize ?? 0);
      documentDeletes.push(item.ref);
    }

    for (const item of videoSnapshot.docs) {
      documentDeletes.push(item.ref);
    }

    for (const item of musicSnapshot.docs) {
      documentDeletes.push(item.ref);
    }

    await Promise.all(storageDeletes);
    await commitDeleteBatch(documentDeletes);

    await Promise.all([
      userRef.collection("backups").doc("current").set(
        {
          userId: uid,
          status: "deleted",
          photoCount: 0,
          imageBundleCount: 0,
          videoCount: 0,
          musicCount: 0,
          imageBackupBytes: 0,
          settings: FieldValue.delete(),
          imageBundles: FieldValue.delete(),
          videos: FieldValue.delete(),
          backedUpAt: null,
          deleteAfter: null,
          deletedAt: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      ),
      getUsageRef(uid).set(
        {
          imageTotalBytes: 0,
          videoCount: 0,
          videoTotalBytes: 0,
          audioTotalBytes: 0,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      )
    ]);

    return {
      photoCount: photoSnapshot.size,
      imageBundleCount: imageWorkSnapshot.size,
      videoCount: videoSnapshot.size,
      musicCount: musicSnapshot.size,
      imageBackupBytes,
      deleteAfter: null
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

// Cloud backup deletion is handled only from an explicit in-app user request.
// No scheduled cleanup function is exported.
