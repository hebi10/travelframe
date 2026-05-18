const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  assertBackupUploadAllowed,
  getBackupUsageDelta,
  normalizeBackupUsage,
  addBackupUsage
} = require("./backup-quota");

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;

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
    message.includes("media kind")
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

const getCreatorSubscription = async (uid) => {
  const [currentSnapshot, creatorSnapshot] = await Promise.all([
    db.doc(`users/${uid}/subscriptions/current`).get(),
    db.doc(`users/${uid}/subscriptions/creator_monthly`).get()
  ]);

  const current = currentSnapshot.exists ? currentSnapshot.data() : null;
  if (current?.productId === "creator_monthly") {
    return current;
  }

  return creatorSnapshot.exists ? creatorSnapshot.data() : current;
};

const getUsageRef = (uid) => db.doc(`users/${uid}/backupUsage/current`);
const getSessionRef = (uid, sessionId) =>
  db.doc(`users/${uid}/backupUploadSessions/${sessionId}`);

exports.reserveBackupUpload = onCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { mediaKind, fileSize, contentType, storagePath } = request.data ?? {};
    const subscription = await getCreatorSubscription(uid);
    const usageRef = getUsageRef(uid);
    const sessionRef = db.collection(`users/${uid}/backupUploadSessions`).doc();

    await db.runTransaction(async (transaction) => {
      const usageSnapshot = await transaction.get(usageRef);
      const usage = normalizeBackupUsage(usageSnapshot.data());

      assertBackupUploadAllowed({
        uid,
        subscription,
        usage,
        mediaKind,
        fileSize,
        contentType,
        storagePath
      });

      const delta = getBackupUsageDelta({ mediaKind, fileSize });
      transaction.set(sessionRef, {
        userId: uid,
        mediaKind,
        fileSize,
        contentType,
        storagePath,
        usageDelta: delta,
        status: "reserved",
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 15 * 60 * 1000)
      });
      transaction.set(
        usageRef,
        {
          ...usage,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    });

    return {
      backupSessionId: sessionRef.id,
      storagePath,
      expiresInSeconds: 15 * 60
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.completeBackupUpload = onCall(async (request) => {
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
      throw new HttpsError("deadline-exceeded", "Backup upload session expired.");
    }

    const [metadata] = await bucket.file(session.storagePath).getMetadata();
    const objectSize = Number(metadata.size);
    const objectContentType = metadata.contentType;
    const objectSessionId = metadata.metadata?.backupSessionId;

    if (
      objectSize !== session.fileSize ||
      objectContentType !== session.contentType ||
      objectSessionId !== backupSessionId
    ) {
      throw new HttpsError("failed-precondition", "Uploaded backup object does not match the reserved session.");
    }

    const nextUsage = await db.runTransaction(async (transaction) => {
      const [freshSessionSnapshot, usageSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(getUsageRef(uid))
      ]);
      const freshSession = freshSessionSnapshot.data();
      if (!freshSessionSnapshot.exists || freshSession.status !== "reserved") {
        return normalizeBackupUsage(usageSnapshot.data());
      }

      const usage = normalizeBackupUsage(usageSnapshot.data());
      const usageDelta = freshSession.usageDelta ?? getBackupUsageDelta({
        mediaKind: freshSession.mediaKind,
        fileSize: freshSession.fileSize
      });
      const updatedUsage = addBackupUsage(usage, usageDelta);

      transaction.set(
        getUsageRef(uid),
        {
          ...updatedUsage,
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

    return { usage: nextUsage };
  } catch (error) {
    throw toHttpsError(error);
  }
});

exports.releaseBackupUpload = onCall(async (request) => {
  try {
    const uid = requireUid(request);
    const { backupSessionId } = request.data ?? {};
    if (typeof backupSessionId !== "string" || !backupSessionId) {
      throw new HttpsError("invalid-argument", "backupSessionId is required.");
    }

    const sessionRef = getSessionRef(uid, backupSessionId);
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
      }
    });

    return { released: true };
  } catch (error) {
    throw toHttpsError(error);
  }
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

const commitDeleteBatch = async (refs) => {
  for (let index = 0; index < refs.length; index += 450) {
    const batch = db.batch();
    for (const ref of refs.slice(index, index + 450)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
};

exports.deleteCloudBackupData = onCall(async (request) => {
  try {
    const uid = requireUid(request);
    const userRef = db.doc(`users/${uid}`);
    const [photoSnapshot, imageWorkSnapshot, videoSnapshot] = await Promise.all([
      userRef.collection("photoBackups").get(),
      userRef.collection("imageWorks").get(),
      userRef.collection("videos").get()
    ]);

    let imageBackupBytes = 0;
    const storageDeletes = [];
    const documentDeletes = [];

    for (const item of photoSnapshot.docs) {
      const data = item.data();
      imageBackupBytes += Number(data.imageBackupSize ?? data.optimizedSize ?? data.fileSize ?? 0);
      storageDeletes.push(deleteStoragePath(data.storagePath));
      storageDeletes.push(deleteStoragePath(data.previewStoragePath));
      documentDeletes.push(item.ref);
    }

    for (const item of imageWorkSnapshot.docs) {
      const data = item.data();
      imageBackupBytes += Number(data.imageBackupSize ?? 0);
      for (const storagePath of data.storagePaths ?? []) {
        storageDeletes.push(deleteStoragePath(storagePath));
      }
      documentDeletes.push(item.ref);
    }

    for (const item of videoSnapshot.docs) {
      const data = item.data();
      storageDeletes.push(deleteStoragePath(data.storagePath));
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
      imageBackupBytes,
      deleteAfter: null
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

// Cloud backup deletion is handled only from an explicit in-app user request.
// No scheduled cleanup function is exported.
