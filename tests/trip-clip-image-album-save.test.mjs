import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/trip-clip-export.ts", "utf8");

assert.ok(
  source.includes('const TRIP_CLIP_MEDIA_ALBUM = "트래블프레임"'),
  "image export should target the app media album"
);
assert.ok(
  source.includes("MediaLibrary.createAssetAsync(saveUri, album)") &&
    source.includes("MediaLibrary.createAlbumAsync(TRIP_CLIP_MEDIA_ALBUM, undefined, true, saveUri)"),
  "image export should create the asset directly in the album without moving an existing photo"
);
assert.ok(
  !source.includes("addAssetsToAlbumAsync([asset], album, false)") &&
    !source.includes("createAlbumAsync(TRIP_CLIP_MEDIA_ALBUM, asset, false)"),
  "image export should not move assets because Android shows a per-photo modify prompt"
);
assert.ok(
  source.includes("saveImageToAndroidDownload"),
  "SAF download save should remain as a fallback for unsupported environments"
);

console.log("ok - trip clip images save to media album without moving assets");
