import assert from "node:assert/strict";
import fs from "node:fs";

const userMusicSource = fs.readFileSync("lib/user-music.ts", "utf8");
const accountSource = fs.readFileSync("app/(tabs)/account.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/trip-clip.tsx", "utf8");
const functionsSource = fs.readFileSync("functions/index.js", "utf8");

assert.ok(
  userMusicSource.includes("const MAX_USER_MUSIC_TRACKS = 10;"),
  "client music hard cap should allow the Pro plan's 10 tracks"
);
assert.ok(
  userMusicSource.includes("musicTrackLimit = 0"),
  "music upload should require a plan-provided track limit"
);
assert.ok(
  userMusicSource.includes("safeMusicTrackLimit <= 0"),
  "music upload should block plans without a music entitlement"
);
assert.ok(
  tripClipSource.includes("pickAndUploadUserMusicTrack(user, planEntitlements.musicTrackLimit)"),
  "trip clip should pass the active plan music limit"
);
assert.ok(
  accountSource.includes("pickAndUploadUserMusicTrack(user, planEntitlements.musicTrackLimit)"),
  "account should pass the active plan music limit"
);
assert.ok(
  functionsSource.includes("const MAX_USER_MUSIC_TRACKS = 10;"),
  "server music quota should allow the Pro plan's 10 tracks"
);

console.log("ok - user music uploads are gated by plan music limits");
