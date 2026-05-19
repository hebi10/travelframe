import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/trip-clip-export.ts", "utf8");

assert.ok(
  source.includes('const TRIP_CLIP_MEDIA_ALBUM = "트래블프레임"'),
  "image export should target the app media album"
);
assert.ok(
  source.includes("MediaLibrary.createAssetAsync(saveUri)") &&
    source.includes("MediaLibrary.createAlbumAsync(TRIP_CLIP_MEDIA_ALBUM, asset, false)") &&
    source.includes("MediaLibrary.addAssetsToAlbumAsync([asset], album, false)"),
  "image export should save into a MediaLibrary album without opening the folder picker"
);
assert.ok(
  source.includes("saveImageToAndroidDownload"),
  "SAF download save should remain as a fallback for unsupported environments"
);

console.log("ok - trip clip images save to media album before SAF fallback");
