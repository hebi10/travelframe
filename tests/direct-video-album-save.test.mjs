import assert from "node:assert/strict";
import fs from "node:fs";

const exportSource = fs.readFileSync("lib/trip-clip-export.ts", "utf8");
const tripClipScreen = fs.readFileSync(
  "features/trip-clip/TripClipScreen.tsx",
  "utf8"
);
const bodyFrameVideoScreen = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "utf8"
);

for (const token of [
  'const TRIP_CLIP_ANDROID_DOWNLOAD_FOLDER = "Body Frame";',
  'const TRIP_CLIP_MEDIA_ALBUM = "Body Frame";',
  'const saveVideoToAndroidAlbum = async (uri: string) => {',
  'await requestSavePermission("video")',
  'MediaLibrary.getAlbumAsync(TRIP_CLIP_MEDIA_ALBUM)',
  'MediaLibrary.createAssetAsync(uri, album)',
  'MediaLibrary.createAlbumAsync(TRIP_CLIP_MEDIA_ALBUM, undefined, true, uri)',
  'return await saveVideoToAndroidAlbum(uri);'
]) {
  assert.ok(
    exportSource.includes(token),
    `direct Android video album save missing: ${token}`
  );
}

assert.equal(
  exportSource.includes("const saveVideoToAndroidDownload"),
  false,
  "Android video export should not use SAF/download-directory saving"
);

const saveVideoStart = exportSource.indexOf(
  "export const saveVideoToLibrary = async"
);
const saveVideoEnd = exportSource.indexOf(
  "export const saveImageToLibrary",
  saveVideoStart
);
const saveVideoSource = exportSource.slice(saveVideoStart, saveVideoEnd);

for (const forbidden of [
  "requestDirectoryPermissionsAsync",
  "StorageAccessFramework",
  "saveFileToAndroidDownload"
]) {
  assert.equal(
    saveVideoSource.includes(forbidden),
    false,
    `video save should not ask the user to pick a directory: ${forbidden}`
  );
}

assert.ok(
  tripClipScreen.includes(
    "완성된 MP4 영상을 Body Frame 앨범에 저장하고 있습니다."
  ) &&
    tripClipScreen.includes(
      "저장한 영상은 핸드폰 Body Frame 앨범에 저장됐습니다."
    ),
  "trip clip save progress should describe the Body Frame album"
);

assert.ok(
  bodyFrameVideoScreen.includes(
    "변화 영상을 Body Frame 앨범에 저장했습니다."
  ),
  "project video save result should describe the Body Frame album"
);

console.log("ok - Android video export saves directly to the Body Frame album");
