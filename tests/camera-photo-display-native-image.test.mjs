import assert from "node:assert/strict";
import fs from "node:fs";

const studioSource = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");
const photoSource = fs.readFileSync("app/photo/[id].tsx", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

for (const [name, source] of [
  ["camera recent photo", cameraSource],
  ["studio", studioSource],
  ["photo detail", photoSource]
]) {
  assert.ok(source.includes("Image as NativeImage"), `${name} should use native image for saved camera files`);
  assert.ok(source.includes("photo.uri") || source.includes("recentPhoto.uri"), `${name} should render the saved original file`);
  assert.ok(source.includes('resizeMode="'), `${name} should use native resizeMode`);
}

console.log("ok - saved camera photos render original files through native image surfaces");
