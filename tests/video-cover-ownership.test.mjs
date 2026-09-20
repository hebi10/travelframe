import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const deleted = [];
const copied = [];
const storage = new Map();
const fileSystem = { documentDirectory: "file:///documents/", getInfoAsync: async () => ({ exists: true }), makeDirectoryAsync: async () => {}, copyAsync: async (args) => copied.push(args), deleteAsync: async (uri) => deleted.push(uri) };
const exports = {};
const code = ts.transpileModule(fs.readFileSync("lib/video-library.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { exports, require: (id) => {
  if (id === "@/lib/private-storage") return { downloadPrivateFile: async () => { throw new Error("unexpected remote download"); } };
  if (id === "expo-file-system/legacy") return fileSystem;
  if (id.endsWith("local-storage")) return { localStorageAdapter: { getItem: async (k) => storage.get(k), setItem: async (k,v) => storage.set(k,v) } };
  if (id.endsWith("local-library-limit")) return { assertLocalLibraryCapacity: () => {} };
  if (id.endsWith("trip-clip-title")) return { getNextTripClipTitle: () => "video", TRIP_CLIP_TITLE_PREFIX: "video" };
  throw new Error(id);
} });
const original = "file:///documents/projects/a/photos/0001.jpg";
const saved = await exports.saveMadeVideo({ uri: "file:///cache/output.mp4", coverUri: original, title: "video", ratio: "9:16", template: "minimal", transition: "none", duration: 1, photoIds: [] });
assert.notEqual(saved.coverUri, original, "video must own a cover copy");
assert.ok(copied.some((copy) => copy.from === original && copy.to === saved.coverUri));
await exports.deleteMadeVideo(saved.id);
assert.ok(!deleted.includes(original));
await exports.replaceMadeVideosFromBackup([{ ...saved, id: "old", coverUri: original }]);
await exports.deleteMadeVideo("old");
assert.ok(!deleted.includes(original), "old shared covers must also be protected");
console.log("ok - deleting a video never deletes its source photo");
