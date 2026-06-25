import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/video/[id].tsx", "utf8");

for (const snippet of [
  "function VideoPlayerFrame({ source }: { source: string })",
  "const player = useVideoPlayer(source",
  "const hasPlayableVideoSource = Boolean(videoSource);",
  "{hasPlayableVideoSource ? (",
  "<VideoPlayerFrame source={videoSource as string} />",
  "nativeControls",
  "contentFit=\"contain\"",
  "surfaceType=\"textureView\"",
  "useExoShutter",
  "영상을 재생할 파일을 찾지 못했습니다.",
  "onPress={() => router.replace(\"/studio?tab=works\" as Href)}"
]) {
  assert.ok(source.includes(snippet), `video detail should guard Android video playback: ${snippet}`);
}

assert.equal(
  source.includes("allowsPictureInPicture"),
  false,
  "video detail should not enable PiP without matching Android manifest configuration"
);

console.log("ok - video detail uses Android-safe video player configuration");
