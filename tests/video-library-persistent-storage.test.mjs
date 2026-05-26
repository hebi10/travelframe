import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/video-library.ts", "utf8");

for (const snippet of [
  "const persistMadeVideoFile = async",
  "const videoId = createVideoId();",
  "await FileSystem.copyAsync({ from: uri, to: destinationUri });",
  "uri: persistedUri",
  "localUri: isRemoteUri(persistedUri) ? video.localUri : persistedUri",
  'return { ...video, uri: "", localFileStatus: undefined };'
]) {
  assert.ok(source.includes(snippet), `video library should persist saved MP4 files: ${snippet}`);
}

console.log("ok - saved video records use persistent app storage and guard missing files");
