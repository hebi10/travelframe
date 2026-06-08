import assert from "node:assert/strict";
import fs from "node:fs";

const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const firestoreRules = fs.readFileSync("firestore.rules", "utf8");
const storageRules = fs.readFileSync("storage.rules", "utf8");
const userMusicSource = fs.readFileSync("lib/user-music.ts", "utf8");

for (const snippet of [
  "reserveMusicUpload",
  "completeMusicUpload",
  "releaseMusicUpload",
  "musicUploadSessions",
  "MAX_USER_MUSIC_TRACKS",
  "MAX_PENDING_MUSIC_UPLOAD_SESSIONS",
  "MAX_PENDING_MUSIC_UPLOAD_BYTES",
  "cleanupExpiredMusicUploadSessions",
  "getReservedMusicUploadSummary",
  "getMusicTrackLimit",
  "Active music subscription is required",
  "musicTrackLimit"
]) {
  assert.ok(functionsSource.includes(snippet), `Functions missing music quota enforcement: ${snippet}`);
}

for (const snippet of [
  "const activeExpert = isPremiumSubscriptionActive(expert, [\"expert_monthly\"])",
  "const activeCreator = isPremiumSubscriptionActive(creator, [\"creator_monthly\"])",
  "return activeExpert ?? activeCreator ?? activeCurrent ?? expert ?? creator ?? current;"
]) {
  assert.ok(functionsSource.includes(snippet), `Functions should prefer active product subscriptions: ${snippet}`);
}

for (const snippet of [
  "match /musicTracks/{trackId}",
  "allow read: if isOwner(userId) || isAdmin();",
  "allow create, update, delete: if false;",
  "match /musicUploadSessions/{sessionId}",
  "allow create, update, delete: if false;"
]) {
  assert.ok(firestoreRules.includes(snippet), `Firestore Rules missing server-owned music metadata: ${snippet}`);
}

for (const snippet of [
  "musicSessionId",
  "musicUploadSession(userId)",
  "isReservedMusicUpload(userId)",
  "allow create, update: if (isReservedMusicUpload(userId) || isReservedAdminMusicUpload(userId)) && isAudioUpload();"
]) {
  assert.ok(storageRules.includes(snippet), `Storage Rules missing music upload session enforcement: ${snippet}`);
}

for (const snippet of [
  "httpsCallable",
  "reserveMusicUpload",
  "completeMusicUpload",
  "releaseMusicUpload",
  "deleteUserBackupItem",
  "musicSessionId"
]) {
  assert.ok(userMusicSource.includes(snippet), `client music upload flow missing server function call: ${snippet}`);
}

assert.equal(
  functionsSource.includes('downloadUrl.startsWith("https://firebasestorage.googleapis.com/")'),
  false,
  "music/admin completion must not trust a client-provided Firebase Storage URL prefix"
);
assert.ok(
  functionsSource.includes("getDownloadUrlFromStorageMetadata"),
  "completion should derive download URLs from Storage metadata when a URL is stored"
);
assert.ok(
  functionsSource.includes('deleteUserBackupItem = secureOnCall'),
  "user backup/music deletion should route through a callable that can remove Storage objects"
);
assert.ok(
  functionsSource.includes("CALLABLE_RUNTIME_OPTIONS") &&
    functionsSource.includes("enforceAppCheck"),
  "callable App Check enforcement should be centrally optioned for production without breaking local tests"
);

console.log("ok - user music uploads are anchored on server quota checks");
