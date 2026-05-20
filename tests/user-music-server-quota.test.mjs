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
  "MAX_USER_MUSIC_TRACKS"
]) {
  assert.ok(functionsSource.includes(snippet), `Functions missing music quota enforcement: ${snippet}`);
}

for (const snippet of [
  "match /musicTracks/{trackId}",
  "allow read, delete: if isOwner(userId) || isAdmin();",
  "allow create, update: if false;",
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
  "musicSessionId"
]) {
  assert.ok(userMusicSource.includes(snippet), `client music upload flow missing server function call: ${snippet}`);
}

console.log("ok - user music uploads are anchored on server quota checks");
