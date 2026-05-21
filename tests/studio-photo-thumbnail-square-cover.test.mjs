import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(tabs)/studio.tsx", "utf8");
const photoCardStart = source.indexOf("function PhotoCard");
const photoCardEnd = source.indexOf("function PageSizeSelector", photoCardStart);
const thumbnailStyleStart = source.indexOf("thumbnail: {");
const thumbnailStyleEnd = source.indexOf("photoMeta:", thumbnailStyleStart);

assert.ok(photoCardStart >= 0 && photoCardEnd > photoCardStart, "studio should define PhotoCard");
assert.ok(
  thumbnailStyleStart >= 0 && thumbnailStyleEnd > thumbnailStyleStart,
  "studio should define thumbnail style"
);

const photoCard = source.slice(photoCardStart, photoCardEnd);
const thumbnailStyle = source.slice(thumbnailStyleStart, thumbnailStyleEnd);

assert.ok(
  photoCard.includes('resizeMode="cover"'),
  "photo thumbnails should crop overflowing image areas"
);
assert.ok(
  thumbnailStyle.includes("aspectRatio: 1"),
  "photo thumbnails should render as square tiles"
);

console.log("ok - studio photo thumbnails are square cover crops");
