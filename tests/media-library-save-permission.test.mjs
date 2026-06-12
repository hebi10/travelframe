import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const exportSource = readFileSync("lib/trip-clip-export.ts", "utf8");

assert.ok(
  exportSource.includes("getMediaLibraryAccessState") &&
    exportSource.includes("getMediaLibraryPermissionMessage"),
  "media library saving should classify the actual album permission state"
);

assert.ok(
  exportSource.includes("const state = getMediaLibraryAccessState(permission)") &&
    exportSource.includes('if (state !== "full")'),
  "media library saving should require full album permission before writing to the phone album"
);

assert.ok(
  !exportSource.includes("MediaLibrary.requestPermissionsAsync(true, [kind])"),
  "Android album saving should not use write-only permission because it can save while Settings still shows no album access"
);

assert.ok(
  exportSource.includes("MediaLibrary.requestPermissionsAsync(false, [kind])"),
  "Android album saving should request visible album access so denied permission blocks device saves"
);

console.log("ok - media library saving requires visible phone album permission");
