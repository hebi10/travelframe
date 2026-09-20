import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

for (const [file, method, storageKey, item] of [
  ["legacy-photo-library", "restorePhotoOriginalIfNeeded", "travel-frame.photos.v1", { id: "p", uri: "https://storage/photo", createdAt: "2026-01-01" }],
  ["video-library", "restoreMadeVideoIfNeeded", "travel-frame.videos.v1", { id: "v", uri: "https://storage/video", createdAt: "2026-01-01" }],
  ["work-library", "restoreImageBundleWorkIfNeeded", "travel-frame.image-bundles.v1", { id: "w", imageUris: ["https://storage/photo"], createdAt: "2026-01-01" }]
]) {
  let denied = false;
  const downloads = [];
  const stored = new Map([[storageKey, JSON.stringify([item])]]);
  const fsMock = {
    documentDirectory: "file:///documents/", makeDirectoryAsync: async () => {},
    getInfoAsync: async () => ({ exists: true }),
    downloadAsync: async () => { throw new Error("unauthenticated download forbidden"); }
  };
  const context = { exports: {}, require: (name) => {
    if (name === "@/lib/private-storage") return { downloadPrivateFile: async (uri, destination) => {
      if (denied) throw new Error("permission denied");
      downloads.push(uri);
      return { uri: destination, status: 200 };
    } };
    if (name === "expo-file-system/legacy") return fsMock;
    if (name === "@/lib/local-storage") return { localStorageAdapter: {
      getItem: async (key) => stored.get(key), setItem: async (key, value) => { stored.set(key, value); }
    } };
    if (name === "@/lib/trip-clip-title") return { TRIP_CLIP_TITLE_PREFIX: "video" };
    return {};
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`lib/${file}.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText, context);
  const restored = await context.exports[method](item);
  assert.equal(downloads.length, 1, `${file} must use authenticated download without requiring cloud_only metadata`);
  assert.equal(restored.localFileStatus, "available");
  assert.match(restored.uri ?? restored.imageUris[0], /^file:/);
  const before = stored.get(storageKey);
  denied = true;
  await assert.rejects(context.exports[method](item), /permission denied/);
  assert.equal(stored.get(storageKey), before, "denied download must not mark the original as restored");
}
console.log("ok - photo/video/bundle restore uses authenticated downloads and fails closed");
