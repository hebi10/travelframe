import assert from "node:assert/strict";
import fs from "node:fs";

const firestoreRules = fs.readFileSync("firestore.rules", "utf8");
const storageRules = fs.readFileSync("storage.rules", "utf8");
const subscriptionSource = fs.readFileSync("lib/subscription.ts", "utf8");
const authContextSource = fs.readFileSync("lib/auth-context.tsx", "utf8");
const backupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");

const assertIncludes = (source, snippet, message) => {
  assert.ok(source.includes(snippet), `${message}: ${snippet}`);
};

const forbiddenMockSnippets = [
  "activateMockSubscription",
  "startMockSubscription",
  "mock_payment_completed",
  'provider == "mock"',
  "isMockSubscription",
  "isMockPaymentEvent",
  "Temporary client-side mock payment flow"
];

for (const snippet of forbiddenMockSnippets) {
  assert.equal(
    firestoreRules.includes(snippet) ||
      subscriptionSource.includes(snippet) ||
      authContextSource.includes(snippet),
    false,
    `mock subscription path should be removed: ${snippet}`
  );
}

for (const snippet of [
  "match /{document=**}",
  "allow read, write: if false;",
  "function isOwner(userId)",
  "return signedIn() && request.auth.uid == userId;",
  "allow create: if isOwner(userId) && isValidUserWrite(userId);"
]) {
  assertIncludes(firestoreRules, snippet, "Firestore owner/default deny rule missing");
}

assertIncludes(
  firestoreRules,
  "allow create, update, delete: if false;",
  "subscriptions and paymentEvents must block client writes"
);
assertIncludes(
  firestoreRules,
  "function isValidBackupStoragePath(userId, storagePath)",
  "backup storage path validator missing"
);
assertIncludes(
  firestoreRules,
  "storagePath.matches('users/' + userId + '/backups/.*')",
  "backup storage path must stay under users/{uid}/backups"
);
assertIncludes(
  firestoreRules,
  "request.resource.data.userId == userId",
  "backup metadata must bind userId to request path"
);
assertIncludes(
  firestoreRules,
  "request.resource.data.keys().hasOnly",
  "backup metadata must reject unexpected client fields"
);
assertIncludes(
  firestoreRules,
  "request.resource.data.diff(resource.data).affectedKeys().hasOnly",
  "backup metadata updates must restrict mutable fields"
);
assertIncludes(
  firestoreRules,
  "function isValidBackupFileSize(fileSize)",
  "backup metadata fileSize validator missing"
);
assertIncludes(
  firestoreRules,
  "fileSize <= 250 * 1024 * 1024",
  "backup metadata fileSize must be capped"
);
assertIncludes(
  firestoreRules,
  'fileType in ["image/jpeg", "image/png", "image/webp", "video/mp4"]',
  "backup metadata fileType allow-list missing"
);
assertIncludes(
  firestoreRules,
  '"musicCount"',
  "backup overview schema must allow server-written musicCount"
);
assertIncludes(
  firestoreRules,
  '"empty"',
  "backup overview schema must allow server-written empty status"
);

for (const snippet of [
  "match /videos/{videoId} {\n        allow read: if isOwner(userId) || isAdmin();\n        allow create: if isOwner(userId) && isValidVideoBackupMetadata(userId, videoId);\n        allow update: if isOwner(userId) && isValidVideoBackupUpdate(userId, videoId);\n        allow delete: if false;",
  "match /imageWorks/{workId} {\n        allow read: if isOwner(userId) || isAdmin();\n        allow create, update: if false;\n        allow delete: if false;",
  "match /musicTracks/{trackId} {\n        allow read: if isOwner(userId) || isAdmin();\n        allow create, update, delete: if false;",
  "match /backups/{backupId} {\n        allow read: if isOwner(userId) || isAdmin();\n        allow create: if isOwner(userId) && isValidBackupOverview(userId, backupId);\n        allow update: if isOwner(userId) && isValidBackupOverviewUpdate(userId, backupId);\n        allow delete: if false;",
  "match /photoBackups/{photoId} {\n        allow read: if isOwner(userId) || isAdmin();\n        allow create: if isOwner(userId) && isValidPhotoBackupMetadata(userId, photoId);\n        allow update: if isOwner(userId) && isValidPhotoBackupUpdate(userId, photoId);\n        allow delete: if false;"
]) {
  assertIncludes(
    firestoreRules,
    snippet,
    "backup metadata deletes must go through server callables"
  );
}

for (const snippet of [
  "request.resource.size < 20 * 1024 * 1024",
  "request.resource.size < 250 * 1024 * 1024",
  "request.resource.size < 50 * 1024 * 1024",
  "request.resource.contentType.matches('image/(jpeg|jpg|png|webp)')",
  "request.resource.contentType == 'video/mp4'",
  "request.resource.contentType.matches('audio/.*')"
]) {
  assertIncludes(storageRules, snippet, "Storage media limit rule missing");
}

assertIncludes(
  storageRules,
  "allow update: if false;",
  "Storage backup objects must not be overwritten after create"
);

const markExpiredSection = backupSource.slice(
  backupSource.indexOf("export const markBackupExpired"),
  backupSource.indexOf("export const deleteCloudBackupData")
);

for (const snippet of [
  "userId: user.uid",
  "photoCount,",
  "imageBundleCount,",
  "videoCount,",
  "imageBackupBytes,"
]) {
  assertIncludes(
    markExpiredSection,
    snippet,
    "markBackupExpired must write fields accepted by backup overview rules"
  );
}

console.log("ok - Firebase rules block client billing writes and validate backup metadata");
