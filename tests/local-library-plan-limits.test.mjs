import assert from "node:assert/strict";
import fs from "node:fs";

const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
const photoTypesSource = fs.readFileSync("types/photo.ts", "utf8");
const videoLibrarySource = fs.readFileSync("lib/video-library.ts", "utf8");
const workLibrarySource = fs.readFileSync("lib/work-library.ts", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const capturePreviewSource = fs.readFileSync("app/capture-preview.tsx", "utf8");
const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const studioSource = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/trip-clip.tsx", "utf8");

for (const [name, source] of [
  ["photo library", photoLibrarySource],
  ["video library", videoLibrarySource],
  ["work library", workLibrarySource]
]) {
  assert.ok(source.includes("assertLocalLibraryCapacity"), `${name} should enforce local library capacity`);
}

assert.ok(
  photoTypesSource.includes("localImageLimit?: number"),
  "photo save inputs should accept the current plan image limit"
);
assert.ok(
  videoLibrarySource.includes("localVideoLimit?: number"),
  "video saves should accept the current plan video limit"
);
assert.ok(
  workLibrarySource.includes("localImageLimit?: number"),
  "image bundle saves should accept the current plan image limit"
);

for (const [name, source] of [
  ["camera", cameraSource],
  ["capture preview", capturePreviewSource],
  ["edit", editSource],
  ["studio", studioSource],
  ["trip clip", tripClipSource]
]) {
  assert.ok(source.includes("planEntitlements.localImageLimit"), `${name} should pass local image limits`);
}

assert.ok(
  tripClipSource.includes("localVideoLimit: planEntitlements.localVideoLimit"),
  "trip clip should pass local video limits when saving MP4 records"
);

console.log("ok - local app library saves enforce plan image and video limits");
