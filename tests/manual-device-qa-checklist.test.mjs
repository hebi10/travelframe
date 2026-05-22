import assert from "node:assert/strict";
import fs from "node:fs";

const checklist = fs.readFileSync("docs/manual-device-qa.md", "utf8");

for (const snippet of [
  "Android 실기기",
  "카메라 가이드",
  "위치·모양 조절",
  "MediaLibrary",
  "Firebase 백업",
  "백업 데이터 삭제",
  "실패한 백업 다시 시도",
  "여행클립 MP4",
  "구독"
]) {
  assert.ok(checklist.includes(snippet), `manual QA checklist missing: ${snippet}`);
}

console.log("ok - manual device QA checklist covers native-only service flows");
