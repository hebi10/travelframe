import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/trip-clip-export.ts", "utf8");
const saveVideoStart = source.indexOf("export const saveVideoToLibrary = async");
const saveImageStart = source.indexOf("export const saveImageToLibrary = async");

assert.notEqual(saveVideoStart, -1, "saveVideoToLibrary should exist");
assert.notEqual(saveImageStart, -1, "saveImageToLibrary should exist");

const saveVideoBlock = source.slice(saveVideoStart, saveImageStart);

assert.ok(
  source.includes("const saveVideoToAndroidAlbum = async"),
  "Android video export should have a direct album save path"
);
assert.ok(
  saveVideoBlock.includes('if (Platform.OS === "android")'),
  "Android video export should branch to the Android album helper"
);
assert.ok(
  saveVideoBlock.includes("return await saveVideoToAndroidAlbum(uri);"),
  "Android video export should save directly into the Body Frame album"
);
assert.equal(
  saveVideoBlock.includes("requestDirectoryPermissionsAsync"),
  false,
  "Android video export should not show a directory picker"
);
assert.ok(
  source.includes('await requestSavePermission("video")'),
  "Android video export should resolve video media permission before saving"
);

console.log("ok - Android video export asks media permission once and saves directly to Body Frame");
