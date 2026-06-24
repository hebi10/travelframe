import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/trip-clip-export.ts", "utf8");
const saveVideoStart = source.indexOf("export const saveVideoToLibrary = async");
const saveImageStart = source.indexOf("export const saveImageToLibrary = async");

assert.notEqual(saveVideoStart, -1, "saveVideoToLibrary should exist");
assert.notEqual(saveImageStart, -1, "saveImageToLibrary should exist");

const saveVideoBlock = source.slice(saveVideoStart, saveImageStart);

assert.ok(
  source.includes("const saveVideoToAndroidDownload = async"),
  "Android video export should have a SAF download save path"
);
assert.ok(
  saveVideoBlock.includes('if (Platform.OS === "android")'),
  "Android video export should branch away from album permissions"
);
assert.ok(
  saveVideoBlock.includes("return await saveVideoToAndroidDownload(uri);"),
  "Android video export should save through SAF downloads"
);
assert.ok(
  saveVideoBlock.indexOf("return await saveVideoToAndroidDownload(uri);") <
    saveVideoBlock.indexOf('requestSavePermission("video")'),
  "Android video export should not show the limited media access permission prompt"
);

console.log("ok - Android video export saves through downloads without media access prompt");
