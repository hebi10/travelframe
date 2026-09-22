import assert from "node:assert/strict";
import fs from "node:fs";

const videoScreen = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "utf8"
);
const optionSheet = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoOptionsSheet.tsx",
  "utf8"
);
const videoModel = fs.readFileSync("lib/body-frame-video.ts", "utf8");

assert.ok(
  videoModel.includes("firstSequence - secondSequence"),
  "Body Frame video photos should keep ascending project sequence order"
);

assert.ok(
  videoScreen.includes("프로젝트의 사진 순서(#1 → #2 → #3 …)대로 만들어집니다") &&
    videoScreen.includes("프로젝트 상세의 순서 조정"),
  "video screen should explain that playback order comes from project sequence"
);

assert.ok(
  optionSheet.includes("사진 선택에서는 포함할 사진만 고를 수 있습니다") &&
    optionSheet.includes("순서 변경은 프로젝트 상세의 순서 조정"),
  "photo selection sheet should explicitly say it does not reorder photos"
);

console.log("ok - Body Frame video order follows project sequence and the UI explains where to reorder");
