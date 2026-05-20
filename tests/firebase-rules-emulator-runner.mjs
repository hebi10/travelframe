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

const storageRequest = async (method, name, { uid, contentType, metadata, bytes } = {}) => {
  const uploadUrl = `${storageBase}?uploadType=media&name=${encodeURIComponent(name)}`;
  const objectUrl = `${storageBase}/${encodeStorageName(name)}?alt=media`;
  const isWrite = method === "POST" || method === "PUT";

  return fetch(isWrite ? uploadUrl : objectUrl, {
    method,
    headers: authHeaders(uid, {
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...Object.fromEntries(
        Object.entries(metadata ?? {}).map(([key, value]) => [`x-goog-meta-${key}`, value])
      )
    }),
    body: isWrite ? bytes ?? new Uint8Array([1, 2, 3]) : undefined
  });
};

const seedBackupUploadSession = async ({
  uid = ownerUid,
  sessionId = "photo-session",
  storagePath = `users/${ownerUid}/backups/photos/photo-session.jpg`,
  fileSize = 3,
  contentType = "image/jpeg",
  mediaKind = "image"
} = {}) => {
  await seedDoc(`users/${uid}/backupUploadSessions/${sessionId}`, {
    userId: uid,
    status: "reserved",
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

await seedDoc(`admins/${adminUid}`, { role: "admin" });
await expectAllowed(
  "users with admin documents can read another user's document",
  firestoreRequest("GET", `users/${ownerUid}`, { uid: adminUid })
);

const validStoragePath = `users/${ownerUid}/backups/photos/photo-session.jpg`;
await seedBackupUploadSession({ storagePath: validStoragePath });
await expectDenied(
  "unauthenticated users cannot read backup files",
  storageRequest("GET", validStoragePath)
);
await expectDenied(
  "storage uploads without upload sessions are blocked",
  storageRequest("POST", `users/${ownerUid}/backups/photos/no-session.jpg`, {
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
await expectAllowed(
  "owners can read their own backup files",
  storageRequest("GET", validStoragePath, { uid: ownerUid })
);

const badTypePath = `users/${ownerUid}/backups/photos/bad-type.jpg`;
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

const tooLargePath = `users/${ownerUid}/backups/photos/too-large.jpg`;
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
