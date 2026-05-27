import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/video/[id].tsx", "utf8");

for (const snippet of [
  "class VideoPlaybackBoundary extends Component",
  "static getDerivedStateFromError",
  "componentDidCatch(error: Error)",
  "<VideoPlaybackBoundary>",
  "</VideoPlaybackBoundary>",
  "영상 재생 화면을 열지 못했습니다."
]) {
  assert.ok(source.includes(snippet), `video detail player boundary missing: ${snippet}`);
}

console.log("ok - video detail contains player error boundary");
