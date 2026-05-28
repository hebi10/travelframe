import assert from "node:assert/strict";

const projectId = "travelframe-4e1fb";
const bucket = `${projectId}.appspot.com`;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;

assert.ok(firestoreHost, "FIRESTORE_EMULATOR_HOST must be set by firebase emulators:exec");
assert.ok(storageHost, "FIREBASE_STORAGE_EMULATOR_HOST must be set by firebase emulators:exec");

const firestoreBase = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents`;
const storageBase = `http://${storageHost}/v0/b/${bucket}/o`;

const ownerUid = "owner-user";
const otherUid = "other-user";
const adminUid = "admin-user";

const encodeSegment = (value) => encodeURIComponent(value);
const encodeStorageName = (name) => encodeURIComponent(name).replaceAll("%2F", "%2F");

const unsignedToken = (uid) => {
  if (!uid) {
    return undefined;
  }

  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

  return [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      aud: projectId,
      auth_time: 0,
      exp: 4102444800,
      firebase: { sign_in_provider: "custom" },
      iat: 0,
      iss: `https://securetoken.google.com/${projectId}`,
      sub: uid,
      user_id: uid
    }),
    ""
  ].join(".");
};

const authHeaders = (uid, extra = {}) => ({
  ...extra,
  ...(uid ? { Authorization: `Bearer ${unsignedToken(uid)}` } : {})
});

const adminHeaders = (extra = {}) => ({
  ...extra,
  Authorization: "Bearer owner"
});

const storageAuthHeaders = (uid, extra = {}) => ({
  ...extra,
  ...(uid ? { Authorization: `Bearer ${unsignedToken(uid)}` } : {})
});

const firestoreValue = (value) => {
  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return { integerValue: String(value) };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }

  if (value && typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [key, firestoreValue(nestedValue)])
        )
      }
    };
  }

  return { nullValue: null };
};

const firestoreDoc = (data) => ({
  fields: Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])
  )
});

const firestoreUrl = (path) =>
  `${firestoreBase}/${path.split("/").map(encodeSegment).join("/")}`;

const firestoreRequest = async (method, path, { uid, data } = {}) => {
  const response = await fetch(firestoreUrl(path), {
    method,
    headers: authHeaders(uid, data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(firestoreDoc(data)) : undefined
  });

  return response;
};

const seedDoc = async (path, data) => {
  const response = await fetch(firestoreUrl(path), {
    method: "PATCH",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(firestoreDoc(data))
  });

  assert.ok(response.ok, `admin seed should write ${path}: ${response.status} ${await response.text()}`);
};

const expectAllowed = async (label, promise) => {
  const response = await promise;

  assert.ok(response.ok, `${label} should be allowed: ${response.status} ${await response.text()}`);
};

const expectDenied = async (label, promise) => {
  const response = await promise;

  assert.ok(
    response.status === 401 || response.status === 403,
    `${label} should be denied: ${response.status} ${await response.text()}`
  );
};

const validBackupOverview = (uid = ownerUid) => ({
  userId: uid,
  photoCount: 0,
  imageBundleCount: 0,
  videoCount: 0,
  imageBackupBytes: 0,
  status: "active"
});

const validPhotoBackup = (uid = ownerUid, photoId = "photo-1") => ({
  userId: uid,
  localId: photoId,
  storagePath: `users/${uid}/backups/photos/${photoId}.jpg`,
  fileSize: 1024,
  fileType: "image/jpeg",
  backupSessionId: "photo-session",
  backupStatus: "backed_up"
});

const validVideoBackup = (uid = ownerUid, videoId = "video-1") => ({
  userId: uid,
  localId: videoId,
  storagePath: `users/${uid}/backups/videos/${videoId}.mp4`,
  fileSize: 2048,
  fileType: "video/mp4",
  backupSessionId: "video-session",
  backupStatus: "backed_up"
});

const validImageWorkBackup = (uid = ownerUid, workId = "work-1") => ({
  userId: uid,
  localId: workId,
  storagePaths: [`users/${uid}/backups/image-works/${workId}/image-1.jpg`],
  backupSessionIds: ["image-work-session"],
  fileSize: 1024,
  imageBackupSize: 1024,
  backupStatus: "backed_up"
});

const validSubscription = (productId) => ({
  plan: "premium",
  provider: "admin",
  productId,
  status: "active",
  startedAt: "2026-05-18T00:00:00.000Z",
  expiresAt: null,
  lastPaymentAt: "2026-05-18T00:00:00.000Z",
  priceLabel: "test",
  productName: productId
});

const weeklyVideoUsage = ({ uid = ownerUid, weekId = "2026-05-18", count, limit }) => ({
  userId: uid,
  weekId,
  weekLabel: "5월 18일 - 5월 24일",
  count,
  limit,
  createdAt: new Date("2026-05-18T00:00:00.000Z"),
  updatedAt: new Date("2026-05-18T00:00:00.000Z")
});

const storageRequest = async (method, name, { uid, contentType, metadata, bytes } = {}) => {
  const uploadUrl = `${storageBase}?uploadType=media&name=${encodeURIComponent(name)}${
    contentType ? `&contentType=${encodeURIComponent(contentType)}` : ""
  }`;
  const objectUrl = `${storageBase}/${encodeStorageName(name)}?alt=media`;
  const objectMetadataUrl = `${storageBase}/${encodeStorageName(name)}`;
  const isWrite = method === "POST" || method === "PUT";
  const isMetadataUpdate = method === "PATCH";

  return fetch(isWrite ? uploadUrl : isMetadataUpdate ? objectMetadataUrl : objectUrl, {
    method,
    headers: storageAuthHeaders(uid, {
      ...(isMetadataUpdate
        ? { "Content-Type": "application/json" }
        : contentType
          ? { "Content-Type": contentType }
          : {}),
      ...Object.fromEntries(
        Object.entries(metadata ?? {}).map(([key, value]) => [`x-goog-meta-${key}`, value])
      )
    }),
    body: isWrite
      ? bytes ?? new Uint8Array([1, 2, 3])
      : isMetadataUpdate
        ? JSON.stringify({ metadata: metadata ?? { updatedByTest: "true" } })
        : undefined
  });
};

const seedBackupUploadSession = async ({
  uid = ownerUid,
  sessionId = "photo-session",
  storagePath = `users/${ownerUid}/backups/photos/${sessionId}/photo-session.jpg`,
  fileSize = 3,
  contentType = "image/jpeg",
  mediaKind = "image",
  status = "reserved"
} = {}) => {
  await seedDoc(`users/${uid}/backupUploadSessions/${sessionId}`, {
    userId: uid,
    status,
    mediaKind,
    storagePath,
    fileSize,
    contentType,
    expiresAt: new Date(Date.now() + 60_000)
  });
};

await seedDoc(`users/${ownerUid}`, { uid: ownerUid });
await seedDoc(`users/${otherUid}`, { uid: otherUid });

await expectDenied(
  "unauthenticated users cannot read backup overview",
  firestoreRequest("GET", `users/${ownerUid}/backups/current`)
);
await expectAllowed(
  "owners can create their own current backup overview",
  firestoreRequest("PATCH", `users/${ownerUid}/backups/current`, {
    uid: ownerUid,
    data: validBackupOverview()
  })
);
await expectDenied(
  "backup overview rejects unexpected client fields",
  firestoreRequest("PATCH", `users/${ownerUid}/backups/current`, {
    uid: ownerUid,
    data: { ...validBackupOverview(), clientInjectedField: true }
  })
);
await expectDenied(
  "users cannot write another user's backup overview path",
  firestoreRequest("PATCH", `users/${otherUid}/backups/current`, {
    uid: ownerUid,
    data: validBackupOverview(otherUid)
  })
);
await expectDenied(
  "backup metadata rejects unsupported content types",
  firestoreRequest("PATCH", `users/${ownerUid}/photoBackups/bad-type`, {
    uid: ownerUid,
    data: { ...validPhotoBackup(ownerUid, "bad-type"), fileType: "application/pdf" }
  })
);
await expectDenied(
  "backup metadata rejects files over the size limit",
  firestoreRequest("PATCH", `users/${ownerUid}/photoBackups/too-large`, {
    uid: ownerUid,
    data: { ...validPhotoBackup(ownerUid, "too-large"), fileSize: 250 * 1024 * 1024 + 1 }
  })
);
await expectDenied(
  "owners cannot create photo backup metadata with an unreserved upload session",
  firestoreRequest("PATCH", `users/${ownerUid}/photoBackups/unreserved-photo`, {
    uid: ownerUid,
    data: {
      ...validPhotoBackup(ownerUid, "unreserved-photo"),
      storagePath: `users/${ownerUid}/backups/photos/attacker-picked.jpg`,
      backupSessionId: "attacker-picked-session"
    }
  })
);
await expectDenied(
  "owners cannot create video backup metadata with an unreserved upload session",
  firestoreRequest("PATCH", `users/${ownerUid}/videos/unreserved-video`, {
    uid: ownerUid,
    data: {
      ...validVideoBackup(ownerUid, "unreserved-video"),
      storagePath: `users/${ownerUid}/backups/videos/attacker-picked.mp4`,
      backupSessionId: "attacker-picked-video-session"
    }
  })
);
await expectDenied(
  "owners cannot create image work backup metadata with an unreserved upload session",
  firestoreRequest("PATCH", `users/${ownerUid}/imageWorks/unreserved-work`, {
    uid: ownerUid,
    data: {
      ...validImageWorkBackup(ownerUid, "unreserved-work"),
      storagePaths: [`users/${ownerUid}/backups/image-works/unreserved-work/attacker-picked.jpg`],
      backupSessionIds: ["attacker-picked-work-session"]
    }
  })
);
await seedBackupUploadSession({
  sessionId: "photo-session",
  storagePath: `users/${ownerUid}/backups/photos/photo-1.jpg`,
  fileSize: 1024,
  contentType: "image/jpeg",
  mediaKind: "image",
  status: "completed"
});
await expectAllowed(
  "owners can create valid photo backup metadata",
  firestoreRequest("PATCH", `users/${ownerUid}/photoBackups/photo-1`, {
    uid: ownerUid,
    data: validPhotoBackup(ownerUid, "photo-1")
  })
);
await seedBackupUploadSession({
  sessionId: "video-session",
  storagePath: `users/${ownerUid}/backups/videos/video-1.mp4`,
  fileSize: 2048,
  contentType: "video/mp4",
  mediaKind: "video",
  status: "completed"
});
await expectAllowed(
  "owners can create valid video backup metadata",
  firestoreRequest("PATCH", `users/${ownerUid}/videos/video-1`, {
    uid: ownerUid,
    data: validVideoBackup(ownerUid, "video-1")
  })
);
await seedBackupUploadSession({
  sessionId: "image-work-session",
  storagePath: `users/${ownerUid}/backups/image-works/work-1/image-1.jpg`,
  fileSize: 1024,
  contentType: "image/jpeg",
  mediaKind: "image",
  status: "completed"
});
await expectAllowed(
  "owners can create valid image work backup metadata",
  firestoreRequest("PATCH", `users/${ownerUid}/imageWorks/work-1`, {
    uid: ownerUid,
    data: validImageWorkBackup(ownerUid, "work-1")
  })
);
await seedBackupUploadSession({
  sessionId: "image-work-multi-session-1",
  storagePath: `users/${ownerUid}/backups/image-works/work-multi/image-1.jpg`,
  fileSize: 1024,
  contentType: "image/jpeg",
  mediaKind: "image",
  status: "completed"
});
await expectAllowed(
  "owners can create multi-image work backup metadata with a reserved first upload session",
  firestoreRequest("PATCH", `users/${ownerUid}/imageWorks/work-multi`, {
    uid: ownerUid,
    data: {
      ...validImageWorkBackup(ownerUid, "work-multi"),
      storagePaths: [
        `users/${ownerUid}/backups/image-works/work-multi/image-1.jpg`,
        `users/${ownerUid}/backups/image-works/work-multi/image-2.jpg`
      ],
      backupSessionIds: ["image-work-multi-session-1", "image-work-multi-session-2"],
      fileSize: 2048,
      imageBackupSize: 2048
    }
  })
);
await expectDenied(
  "photo backup metadata rejects unexpected client fields",
  firestoreRequest("PATCH", `users/${ownerUid}/photoBackups/photo-extra`, {
    uid: ownerUid,
    data: { ...validPhotoBackup(ownerUid, "photo-extra"), clientInjectedField: true }
  })
);
await expectAllowed(
  "owners can update mutable photo backup metadata",
  firestoreRequest("PATCH", `users/${ownerUid}/photoBackups/photo-1`, {
    uid: ownerUid,
    data: { ...validPhotoBackup(ownerUid, "photo-1"), backupStatus: "restored" }
  })
);
await expectDenied(
  "photo backup metadata rejects immutable storage path updates",
  firestoreRequest("PATCH", `users/${ownerUid}/photoBackups/photo-1`, {
    uid: ownerUid,
    data: {
      ...validPhotoBackup(ownerUid, "photo-1"),
      storagePath: `users/${ownerUid}/backups/photos/other-path.jpg`
    }
  })
);
await expectDenied(
  "clients cannot create subscription documents",
  firestoreRequest("PATCH", `users/${ownerUid}/subscriptions/client-write`, {
    uid: ownerUid,
    data: { status: "active", userId: ownerUid }
  })
);
await expectDenied(
  "clients cannot create payment event documents",
  firestoreRequest("PATCH", `users/${ownerUid}/paymentEvents/client-write`, {
    uid: ownerUid,
    data: { status: "paid", userId: ownerUid }
  })
);
await expectDenied(
  "users without admin documents cannot read another user's document",
  firestoreRequest("GET", `users/${ownerUid}`, { uid: otherUid })
);

await expectDenied(
  "clients cannot write weekly video export usage directly",
  firestoreRequest("PATCH", `users/${ownerUid}/usage/videoExports/weeks/2026-05-18`, {
    uid: ownerUid,
    data: weeklyVideoUsage({ count: 1, limit: 1 })
  })
);
await expectDenied(
  "clients cannot write weekly video export reservations directly",
  firestoreRequest("PATCH", `users/${ownerUid}/usage/videoExports/weeks/2026-05-18/reservations/direct`, {
    uid: ownerUid,
    data: {
      userId: ownerUid,
      weekId: "2026-05-18",
      reservationId: "direct",
      status: "reserved"
    }
  })
);
await expectDenied(
  "clients cannot record the pro weekly video export limit directly",
  firestoreRequest("PATCH", `users/${ownerUid}/usage/videoExports/weeks/2026-05-18`, {
    uid: ownerUid,
    data: weeklyVideoUsage({ count: 1, limit: 15 })
  })
);
await seedDoc(`users/${ownerUid}/subscriptions/creator_monthly`, validSubscription("creator_monthly"));
await expectDenied(
  "active creator subscriptions still cannot write weekly video export usage directly",
  firestoreRequest("PATCH", `users/${ownerUid}/usage/videoExports/weeks/2026-05-18`, {
    uid: ownerUid,
    data: weeklyVideoUsage({ count: 15, limit: 15 })
  })
);
await expectDenied(
  "weekly video export usage cannot be written above the recorded plan limit",
  firestoreRequest("PATCH", `users/${ownerUid}/usage/videoExports/weeks/2026-05-18`, {
    uid: ownerUid,
    data: weeklyVideoUsage({ count: 16, limit: 15 })
  })
);
await seedDoc(`users/${ownerUid}/subscriptions/expert_monthly`, validSubscription("expert_monthly"));
await expectDenied(
  "active expert subscriptions still cannot write weekly video export usage directly",
  firestoreRequest("PATCH", `users/${ownerUid}/usage/videoExports/weeks/2026-05-18`, {
    uid: ownerUid,
    data: weeklyVideoUsage({ count: 30, limit: 30 })
  })
);

await seedDoc(`admins/${adminUid}`, { role: "admin" });
await expectAllowed(
  "users with admin documents can read another user's document",
  firestoreRequest("GET", `users/${ownerUid}`, { uid: adminUid })
);

const validStoragePath = `users/${ownerUid}/backups/photos/photo-session/photo-session.jpg`;
await seedBackupUploadSession({ storagePath: validStoragePath });
await expectDenied(
  "unauthenticated users cannot read backup files",
  storageRequest("GET", validStoragePath)
);
await expectDenied(
  "storage uploads without upload sessions are blocked",
  storageRequest("POST", `users/${ownerUid}/backups/photos/no-session/no-session.jpg`, {
    uid: ownerUid,
    contentType: "image/jpeg",
    bytes: new Uint8Array([1, 2, 3])
  })
);
await expectDenied(
  "users cannot upload to another user's backup path",
  storageRequest("POST", validStoragePath, {
    uid: otherUid,
    contentType: "image/jpeg",
    metadata: { backupSessionId: "photo-session" },
    bytes: new Uint8Array([1, 2, 3])
  })
);
await expectAllowed(
  "owners can upload a reserved backup file",
  storageRequest("POST", validStoragePath, {
    uid: ownerUid,
    contentType: "image/jpeg",
    metadata: { backupSessionId: "photo-session" },
    bytes: new Uint8Array([1, 2, 3])
  })
);
await expectDenied(
  "owners cannot update an existing backup file",
  storageRequest("PATCH", validStoragePath, {
    uid: ownerUid,
    metadata: { updatedByTest: "true" }
  })
);
await expectAllowed(
  "owners can read their own backup files",
  storageRequest("GET", validStoragePath, { uid: ownerUid })
);

const badTypePath = `users/${ownerUid}/backups/photos/bad-type-session/bad-type.jpg`;
await seedBackupUploadSession({
  sessionId: "bad-type-session",
  storagePath: badTypePath,
  contentType: "application/pdf"
});
await expectDenied(
  "storage uploads reject unsupported content types",
  storageRequest("POST", badTypePath, {
    uid: ownerUid,
    contentType: "application/pdf",
    metadata: { backupSessionId: "bad-type-session" },
    bytes: new Uint8Array([1, 2, 3])
  })
);

const tooLargePath = `users/${ownerUid}/backups/photos/too-large-session/too-large.jpg`;
const tooLargeBytes = new Uint8Array(20 * 1024 * 1024 + 1);
await seedBackupUploadSession({
  sessionId: "too-large-session",
  storagePath: tooLargePath,
  fileSize: tooLargeBytes.byteLength
});
await expectDenied(
  "storage uploads reject files over the image size limit",
  storageRequest("POST", tooLargePath, {
    uid: ownerUid,
    contentType: "image/jpeg",
    metadata: { backupSessionId: "too-large-session" },
    bytes: tooLargeBytes
  })
);

console.log("ok - Firestore and Storage Rules emulator checks passed");
