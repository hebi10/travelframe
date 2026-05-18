import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/trip-clip.tsx", "utf8");
const constantsSource = readFileSync("constants/video.ts", "utf8");

for (const snippet of [
  "MAX_VIDEO_DURATION_SECONDS",
  "VIDEO_QUALITY_OPTIONS",
  "DEFAULT_VIDEO_QUALITY",
  "calculateVideoDuration",
  "isVideoDurationTooLong",
  "getVideoQualityOutputSize",
  "videoDurationTooLong",
  "videoQuality",
  "bitrate"
]) {
  assert.ok(source.includes(snippet), `trip clip duration/quality missing: ${snippet}`);
}

for (const snippet of [
  "영상은 최대 3분까지 만들 수 있습니다. 사진 수를 줄이거나 사진 노출 시간을 조정해주세요.",
  "영상 길이가 3분을 초과하여 내보내기할 수 없습니다. 사진 수를 줄이거나 사진 노출 시간을 조정해주세요.",
  "화질이 높을수록 영상이 선명하지만 저장 용량이 커질 수 있습니다."
]) {
  assert.ok(constantsSource.includes(snippet), `video constants missing: ${snippet}`);
}

assert.ok(
  source.includes("disabled={isExporting || selectedPhotos.length === 0 || videoDurationTooLong}"),
  "export button should be disabled when no photos or duration is too long"
);

console.log("ok - trip clip enforces video duration and quality settings");
