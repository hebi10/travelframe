import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const studioSource = readStudioSource();

for (const snippet of [
  "allowsMultipleSelection: true",
  "selectionLimit: 20",
  "const importAssets = result.assets.filter",
  "for (const [index, asset] of importAssets.entries())",
  "setImportProgress",
  "이미지를 앱에 저장하는 중입니다.",
  "importProgressTrack",
  "importProgressFill",
  "Math.round(importProgress.percent)",
  "선택한 이미지"
]) {
  assert.ok(studioSource.includes(snippet), `studio multi image import missing: ${snippet}`);
}

console.log("ok - studio imports multiple images with progress");
