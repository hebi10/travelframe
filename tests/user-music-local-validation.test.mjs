import assert from "node:assert/strict";
import fs from "node:fs";

const userMusicSource = fs.readFileSync("lib/user-music.ts", "utf8");

for (const snippet of [
  "const USER_MUSIC_MAX_FILE_BYTES = 50 * 1024 * 1024;",
  "const SUPPORTED_USER_MUSIC_EXTENSIONS = new Set([\"mp3\", \"m4a\", \"wav\", \"aac\", \"ogg\", \"flac\"]);",
  "const DANGEROUS_USER_MUSIC_EXTENSIONS = new Set([\"apk\", \"app\", \"bat\", \"cmd\", \"com\", \"exe\", \"js\", \"msi\", \"ps1\", \"sh\", \"vbs\"]);",
  "const validatePickedMusicAsset = (asset:",
  "asset.size > USER_MUSIC_MAX_FILE_BYTES",
  "Invalid music file size.",
  "!asset.mimeType?.startsWith(\"audio/\")",
  "Invalid music content type.",
  "!SUPPORTED_USER_MUSIC_EXTENSIONS.has(extension)",
  "Unsupported music file extension.",
  "validatePickedMusicAsset(asset);"
]) {
  assert.ok(userMusicSource.includes(snippet), `user music local validation missing: ${snippet}`);
}

const validationIndex = userMusicSource.indexOf("validatePickedMusicAsset(asset);");
const copyIndex = userMusicSource.indexOf("await FileSystem.copyAsync({");

assert.ok(validationIndex >= 0, "music asset validation should run after picking a file");
assert.ok(copyIndex >= 0, "music upload should still copy the validated file locally");
assert.ok(
  validationIndex < copyIndex,
  "music asset validation should block unsupported files before local copy"
);

console.log("ok - user music picker validates size, MIME, and extension before copying");
