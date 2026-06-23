import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

import { readAccountSource } from "./account-test-source.mjs";

const userMusicSource = fs.readFileSync("lib/user-music.ts", "utf8");
const accountSource = readAccountSource();
const tripClipSource = readTripClipSource();
const functionsSource = fs.readFileSync("functions/index.js", "utf8");

assert.ok(
  userMusicSource.includes("const MAX_USER_MUSIC_TRACKS = 20;"),
  "client music hard cap should allow the Expert plan's 20 tracks"
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
  tripClipSource.includes("pickAndUploadUserMusicTrack(") &&
    tripClipSource.includes("planEntitlements.musicTrackLimit"),
  "trip clip should pass the active plan music limit"
);
assert.ok(
  accountSource.includes("pickAndUploadUserMusicTrack(") &&
    accountSource.includes("planEntitlements.musicTrackLimit"),
  "account should pass the active plan music limit"
);
assert.ok(
  functionsSource.includes("const MAX_USER_MUSIC_TRACKS = 20;"),
  "server music hard cap should allow the Expert plan's 20 tracks"
);
assert.ok(
  functionsSource.includes("const getMusicTrackLimit = (subscription)"),
  "server should derive music track limits from the verified subscription"
);

console.log("ok - user music uploads are gated by plan music limits");
