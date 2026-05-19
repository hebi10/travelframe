import assert from "node:assert/strict";
import fs from "node:fs";

const homeSource = fs.readFileSync(
  new URL("../app/(tabs)/home.tsx", import.meta.url),
  "utf8"
);
const appGuideOverlaySource = fs.readFileSync(
  new URL("../components/app-guide-overlay.tsx", import.meta.url),
  "utf8"
);
const useAppGuideSource = fs.readFileSync(
  new URL("../hooks/use-app-guide.ts", import.meta.url),
  "utf8"
);

assert.match(homeSource, /const HOME_SLIDE_IMAGE_ASPECT_RATIO = 2 \/ 3;/);
assert.match(homeSource, /aspectRatio: HOME_SLIDE_IMAGE_ASPECT_RATIO/);
assert.match(homeSource, /contentFit="contain"/);
assert.ok(
  homeSource.includes("tightImage?: boolean"),
  "home slides should allow selected images to be cropped tighter"
);
assert.equal(
  homeSource.match(/tightImage: true/g)?.length,
  2,
  "only the second and third home slides should crop their top whitespace"
);
assert.ok(
  homeSource.includes("styles.heroImageFrame"),
  "home slide images should render inside a clipped frame"
);
assert.ok(
  homeSource.includes("slide.tightImage && styles.heroImageTight"),
  "tight home slides should move the image upward inside the frame"
);

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

assert.ok(
  useAppGuideSource.includes("goToStep"),
  "app guide hook should expose an indexed step setter"
);
assert.ok(
  appGuideOverlaySource.includes(
    "goToStep(Math.max(0, Math.min(guideVisualSlides.length - 1, nextIndex)))"
  ),
  "swiping the guide image should move the guide copy to the same step"
);
assert.ok(
  appGuideOverlaySource.includes("const activeVisualIndex = stepIndex"),
  "guide visual state should be derived from the active guide step"
);
assert.ok(
  appGuideOverlaySource.includes("x: activeVisualIndex * visualWidth"),
  "guide next/back actions should scroll the visual to the active copy"
);

console.log("ok - home slide images use their portrait aspect ratio");
