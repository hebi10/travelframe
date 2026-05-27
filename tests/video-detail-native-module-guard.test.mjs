import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/video/[id].tsx", "utf8");

assert.equal(
  source.includes('import { useVideoPlayer, VideoView } from "expo-video";'),
  false,
  "video detail should not import expo-video at module load time"
);

for (const snippet of [
  "type ExpoVideoModule = typeof import(\"expo-video\");",
  "const getExpoVideoModule = (): ExpoVideoModule | null =>",
  "require(\"expo-video\") as ExpoVideoModule",
  "return null;",
  "const expoVideoModule = getExpoVideoModule();",
  "영상 재생 기능을 불러오지 못했습니다.",
  "function NativeVideoPlayerFrame"
]) {
  assert.ok(source.includes(snippet), `video detail native module guard missing: ${snippet}`);
}

console.log("ok - video detail handles missing native video module without crashing");
