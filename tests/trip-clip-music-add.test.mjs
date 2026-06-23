import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

import { readAccountSource } from "./account-test-source.mjs";

const tripClipSource = readTripClipSource();
const accountSource = readAccountSource();
const userMusicSource = fs.readFileSync("lib/user-music.ts", "utf8");

for (const snippet of [
  'type: "audio/*"',
  "copyToCacheDirectory: true"
]) {
  assert.ok(userMusicSource.includes(snippet), `music picker should open audio files: ${snippet}`);
}

for (const snippet of [
  "pickAndUploadUserMusicTrack(",
  'uploadToCloud: isCloudBackupTargetEnabled(appSettings, "music")',
  "음악 추가"
]) {
  assert.ok(accountSource.includes(snippet), `account music upload missing: ${snippet}`);
}

for (const snippet of [
  "pickAndUploadUserMusicTrack",
  "const [isMusicSubmitting, setIsMusicSubmitting] = useState(false)",
  "const handleAddUserMusic = useCallback(async () =>",
  "const uploadedTrack = nextTracks.find((track) => !previousTrackIds.has(track.id))",
  'setMusicMode("device")',
  "내 음악 추가",
  "파일 앱의 오디오에서 음악 파일을 선택합니다.",
  "userMusicTracks.map((track) =>"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip music add flow missing: ${snippet}`);
}

assert.ok(
  !tripClipSource.includes("MUSIC_MODE_OPTIONS.map"),
  "trip clip music screen should not keep the old mode-tab rendering"
);

assert.ok(
  !tripClipSource.includes('onPress={() => router.push("/account" as Href)}'),
  "trip clip music add should open the audio picker directly instead of routing to account"
);

console.log("ok - trip clip can add audio directly from the music screen");
