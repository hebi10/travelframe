import assert from "node:assert/strict";
import fs from "node:fs";

const homeSource = fs.readFileSync(
  new URL("../app/(tabs)/home.tsx", import.meta.url),
  "utf8"
);

assert.match(homeSource, /const HOME_SLIDE_IMAGE_ASPECT_RATIO = 2 \/ 3;/);
assert.match(homeSource, /aspectRatio: HOME_SLIDE_IMAGE_ASPECT_RATIO/);
assert.match(homeSource, /contentFit="contain"/);

for (const imageName of [
  "home-slide-camera.png",
  "home-slide-edit.png",
  "home-slide-video.png"
]) {
  const image = fs.readFileSync(
    new URL(`../assets/images/${imageName}`, import.meta.url)
  );
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);

  assert.equal(width / height, 2 / 3, `${imageName} should be a 2:3 image`);
}

console.log("ok - home slide images use their portrait aspect ratio");
