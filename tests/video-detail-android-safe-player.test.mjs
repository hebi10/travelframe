import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/video/[id].tsx", "utf8");

for (const snippet of [
  "function VideoPlayerFrame({ source }: { source: string })",
  "const player = useVideoPlayer(source",
  "const hasPlayableVideoSource = Boolean(videoSource);",
  "const [playbackRequested, setPlaybackRequested] = useState(false);",
  "setPlaybackRequested(false);",
  "{hasPlayableVideoSource && playbackRequested ? (",
  "onPress={() => setPlaybackRequested(true)}",
  "영상 재생",
  "<VideoPlayerFrame source={videoSource as string} />",
  "nativeControls",
  "contentFit=\"contain\"",
  "surfaceType=\"surfaceView\"",
  "fullscreenOptions={{ enable: false }}",
  "useExoShutter",
  "영상을 재생할 파일을 찾지 못했습니다.",
  "동영상 만들기와 다시 편집하기는 로그인 후 사용할 수 있습니다.",
  "onPress={() => router.replace(\"/studio?tab=works\" as Href)}"
]) {
  assert.ok(source.includes(snippet), `video detail should guard Android video playback: ${snippet}`);
}

assert.equal(
  source.includes('surfaceType="textureView"'),
  false,
  "single saved-video playback should not force TextureView"
);

assert.equal(
  source.includes("allowsPictureInPicture"),
  false,
  "video detail should not enable PiP without matching Android manifest configuration"
);

console.log("ok - video detail opens before native playback and uses Android-safe player configuration");
