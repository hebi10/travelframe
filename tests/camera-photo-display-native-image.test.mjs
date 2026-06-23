import assert from "node:assert/strict";
import fs from "node:fs";

import { readCameraSource } from "./camera-test-source.mjs";
import { readStudioSource } from "./studio-test-source.mjs";

const studioSource = readStudioSource();
const photoSource = fs.readFileSync("app/photo/[id].tsx", "utf8");
const cameraSource = readCameraSource();

for (const [name, source] of [
  ["camera recent photo", cameraSource],
  ["studio", studioSource],
  ["photo detail", photoSource]
]) {
  assert.ok(source.includes("Image as NativeImage"), `${name} should use native image for saved camera files`);
assert.ok(source.includes("photo.uri") || source.includes("recentPhoto.uri"), `${name} should render the saved original file`);
  assert.ok(source.includes('resizeMode="'), `${name} should use native resizeMode`);
}

for (const forbidden of [
  "AdBanner",
  "photo_detail",
  "togglePhotoForVideo",
  "여행 클립",
  "영상 만들기에 추가",
  "영상 만들기에서 제외"
]) {
  assert.ok(!photoSource.includes(forbidden), `photo detail should not include removed video controls: ${forbidden}`);
}

console.log("ok - saved camera photos render original files through native image surfaces");
