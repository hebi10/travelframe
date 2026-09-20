const { isOwnedCloudBackupStoragePath } = require("./backup-delete-safety");

// Called only for opt-in uploads. Never turn an old completed upload private.
const ensurePrivateStorageDownload = async ({ bucket, uid, session, sessionId, sessionField, metadata }) => {
  const music = sessionField === "musicSessionId";
  if (
    !session || session.userId !== uid || !sessionId ||
    !["backupSessionId", "musicSessionId"].includes(sessionField) ||
    !isOwnedCloudBackupStoragePath(uid, session.storagePath) ||
    (music && !session.storagePath.startsWith(`users/${uid}/music/`)) ||
    (!music && !session.storagePath.startsWith(`users/${uid}/backups/`)) ||
    !["reserved", "completed"].includes(session.status) ||
    (session.status === "completed" && (session.privateDownload !== true || !session.objectGeneration))
  ) throw new Error("Private storage path does not match the upload session.");

  const file = bucket.file(session.storagePath);
  const current = metadata ?? (await file.getMetadata())[0];
  if (
    Number(current.size) !== session.fileSize || current.contentType !== session.contentType ||
    current.metadata?.[sessionField] !== sessionId || !current.generation || !current.metageneration ||
    (session.objectGeneration && String(session.objectGeneration) !== String(current.generation))
  ) throw new Error("Private storage path metadata does not match the upload session.");

  // GCS PATCH uses null to delete a custom metadata field; preconditions prevent
  // changing a replacement object or metadata updated since validation.
  await file.setMetadata({
    metadata: { firebaseStorageDownloadTokens: null, privateDownload: "true" }
  }, {
    ifGenerationMatch: current.generation,
    ifMetagenerationMatch: current.metageneration
  });
  return {
    ...current,
    metadata: { ...current.metadata, firebaseStorageDownloadTokens: null, privateDownload: "true" }
  };
};

const buildStorageDownloadUrl = ({ bucketName, storagePath, metadata }) => {
  if (typeof storagePath !== "string" || !storagePath) return null;
  const base = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
  if (metadata?.metadata?.privateDownload === "true") return base;
  const tokens = metadata?.metadata?.firebaseStorageDownloadTokens;
  const token = typeof tokens === "string" ? tokens.split(",").map((value) => value.trim()).find(Boolean) : null;
  return token ? `${base}&token=${encodeURIComponent(token)}` : null;
};

module.exports = { ensurePrivateStorageDownload, buildStorageDownloadUrl };
