import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Execute production modules; only native and network boundaries are replaced.
const load = (file, dependencies = {}) => {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const context = { exports: {}, require: name => {
    if (!(name in dependencies)) throw Error(`Unexpected import ${name}`);
    return dependencies[name];
  }};
  vm.runInNewContext(code, context, { filename: file });
  return context.exports;
};
const barrier = () => Promise.withResolvers();
const photoKey = "travel-frame.photos.v1";
const oldPhoto = { id: "p", uri: "file:///docs/photos/p-edited.jpg", previewUri: "file:///docs/photo-previews/p-preview.jpg", createdAt: "2026-10-01", width: 100, height: 100, projectId: "pr", sequence: 1 };
function fixture(fault) {
  const storage = new Map([[photoKey, JSON.stringify([oldPhoto])]]);
  const files = new Map([[oldPhoto.uri, "original"], [oldPhoto.previewUri, "preview"], ["file:///rendered.jpg", "edit"], ["file:///camera.jpg", "capture"]]);
  let copyCount = 0;
  const adapter = { getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => {
    if (fault === "metadata" && key === photoKey) throw Error("metadata failure");
    storage.set(key, value);
  }};
  const dependencies = {
    "expo-file-system/legacy": { documentDirectory: "file:///docs/", makeDirectoryAsync: async () => {}, getInfoAsync: async uri => ({ exists: files.has(uri) }), deleteAsync: async uri => { files.delete(uri); }, copyAsync: async ({ from, to }) => {
      copyCount++;
      if (fault === "copy" || fault === "preview" && copyCount === 2) { files.set(to, "partial"); throw Error(`${fault} failure`); }
      assert.ok(files.has(from), `source exists ${from}`); files.set(to, files.get(from));
    }},
    "@/lib/private-storage": { downloadPrivateFile: async (source, uri) => { files.set(uri, "download"); return { uri }; } },
    "expo-image-manipulator": { SaveFormat: { JPEG: "jpeg" }, manipulateAsync: async () => ({ uri: "file:///rendered.jpg", width: 100, height: 100 }) },
    "@/lib/local-storage": { localStorageAdapter: adapter },
    "@/lib/local-library-limit": { assertLocalLibraryCapacity: () => {} },
    "@/lib/image-backup-utils": { optimizeImageForStorage: async x => x, resolveImageDimensions: async () => ({ width: 100, height: 100 }) },
    "@/lib/android-image-adjustment": { hasCameraColorAdjustment: () => false },
    "@/lib/app-settings": { getAppSettings: async () => ({ imageBackupQuality: "high" }) },
    "@/lib/trip-clip-export": {},
    "@/lib/trip-clip-title": { TRIP_CLIP_TITLE_PREFIX: "Clip", getNextTripClipTitle: () => "Clip 1" }
  };
  const api = load("lib/legacy-photo-library.ts", dependencies);
  return { storage, files, adapter, dependencies, api };
}
const editInput = { sourceUri: oldPhoto.uri, targetPhotoId: "p", renderedUri: "file:///rendered.jpg", width: 100, height: 100, transform: { ratioLabel: "Original" } };
for (const fault of ["copy", "preview", "metadata"]) test(`overwrite ${fault} failure keeps original bytes, preview and metadata and removes partial files`, async () => {
  const f = fixture(fault); const before = f.storage.get(photoKey);
  await assert.rejects(f.api.saveEditedPhoto(editInput), new RegExp(`${fault} failure`));
  assert.equal(f.files.get(oldPhoto.uri), "original");
  assert.equal(f.files.get(oldPhoto.previewUri), "preview");
  assert.equal(f.storage.get(photoKey), before);
  assert.deepEqual([...f.files.keys()].sort(), [oldPhoto.uri, oldPhoto.previewUri, "file:///rendered.jpg", "file:///camera.jpg"].sort());
});
test("successful repeated overwrite uses new file versions and keeps immutable identity", async () => {
  const f = fixture(); const first = await f.api.saveEditedPhoto(editInput);
  const second = await f.api.saveEditedPhoto({ ...editInput, sourceUri: first.uri });
  assert.equal(second.id, "p"); assert.notEqual(first.uri, second.uri);
  assert.equal(f.files.has(first.uri), false); assert.equal(f.files.has(second.uri), true);
});
for (const [name, file, key, get, save, merge, remove, data] of [
  ["photo", "lib/legacy-photo-library.ts", photoKey, "getPhotos", "saveEditedPhoto", "mergePhotosFromBackup", "deletePhoto", editInput],
  ["image work", "lib/work-library.ts", "travel-frame.image-bundles.v1", "getImageBundleWorks", "saveImageBundleWork", "mergeImageBundleWorksFromBackup", "deleteImageBundleWork", { imageUris: [], photoIds: [], ratio: "3:4" }],
  ["video", "lib/video-library.ts", "travel-frame.videos.v1", "getMadeVideos", "saveMadeVideo", "mergeMadeVideosFromBackup", "deleteMadeVideo", { uri: "https://video", photoIds: [], ratio: "3:4" }]
]) test(`${name} restore reads latest list and tombstones inside mutation queue`, async () => {
  const f = fixture(); const api = load(file, f.dependencies);
  if (key !== photoKey) f.storage.set(key, "[]");
  const reached = barrier(), resume = barrier(); let pause = true;
  f.adapter.setItem = async (k, v) => { if (k === key && pause) { pause = false; reached.resolve(); await resume.promise; } f.storage.set(k, v); };
  const saving = api[save](data); await reached.promise;
  const restoring = (api[merge] ?? api[merge.replace("merge", "replace")])([{ id: "remote", uri: "https://photo", imageUris: [], photoIds: [], createdAt: "2026-09-01" }]);
  resume.resolve(); const saved = await saving; await restoring;
  assert.ok((await api[get]()).some(x => x.id === saved.id));
  assert.ok((await api[get]()).some(x => x.id === "remote"));
  const deleting = api[remove]("remote");
  const restoreAgain = (api[merge] ?? api[merge.replace("merge", "replace")])([{ id: "remote", uri: "https://photo", imageUris: [], photoIds: [], createdAt: "2026-09-01" }]);
  await Promise.all([deleting, restoreAgain]);
  assert.equal((await api[get]()).some(x => x.id === "remote"), false);
});

function cloudFixture(f, hooks = {}) {
  const user = { uid: "u" }, remote = { ...oldPhoto, localId: "p", sequence: 1, sourceUpdatedAt: "2026-10-01", storagePath: "original/storage", downloadURL: "https://private/photo", uri: "https://private/photo", backupSessionId: "owner-session", sourceDeviceId: "owner-device", backupStatus: "backed_up" };
  const documents = new Map([["photoBackups/p", remote]]); let uploads = 0;
  const deps = new Proxy({
    "@/lib/firebase": { firebaseAuth: { currentUser: user }, firestore: {}, firebaseStorage: {} },
    "@/lib/local-library-owner": { assertLocalLibraryOwner: async () => {} },
    "@/lib/cloud-backup-project-slots": { getSelectedCloudBackupProjectIds: async () => new Set(["pr"]) },
    "@/lib/plan-entitlements": { getPlanEntitlements: () => ({ maxCloudBackupProjects: 1 }) },
    "@/lib/body-project-library": { getBodyProjects: async () => [], mergeBodyProjectsFromBackup: hooks.mergeProjects ?? (async () => {}) },
    "@/lib/work-library": load("lib/work-library.ts", f.dependencies),
    "@/lib/video-library": load("lib/video-library.ts", f.dependencies),
    "@/lib/body-project-backup": load("lib/body-project-backup.ts", {}),
    "@/lib/photo-library": f.api,
    "firebase/firestore": { doc: (_, ...parts) => parts.slice(-2).join("/"), collection: (_, ...parts) => parts.at(-1), getDocs: async prefix => ({ docs: [...documents].filter(([key]) => key.startsWith(`${prefix}/`)).map(([key, data]) => ({ id: key.split("/").at(-1), data: () => data })) }), getDoc: async key => ({ exists: () => documents.has(key), data: () => documents.get(key) }), setDoc: async (key, value, options) => { documents.set(key, options?.merge ? { ...documents.get(key), ...value } : value); }, serverTimestamp: () => "server-time" },
    "firebase/storage": { uploadBytes: async () => { uploads++; throw Error("must not upload"); } }
  }, { has: () => true, get: (target, key) => target[key] ?? {} });
  return { user, documents, remote, api: load("lib/cloud-backup.ts", deps), uploads: () => uploads };
}
test("cloud-only reorder updates metadata while preserving original remote file and session ownership", async () => {
  const f = fixture(); const photo = { ...oldPhoto, sequence: 2, updatedAt: "2026-11-03", localFileStatus: "cloud_only", uri: "https://private/photo" };
  f.storage.set(photoKey, JSON.stringify([photo])); const c = cloudFixture(f);
  const result = await c.api.backupPhoto({ user: c.user, photo, enabled: true });
  assert.ok(result); const record = c.documents.get("photoBackups/p");
  assert.equal(record.sequence, 2); assert.equal(record.sourceUpdatedAt, "2026-11-03");
  for (const key of ["storagePath", "downloadURL", "uri", "backupSessionId", "sourceDeviceId"]) assert.equal(record[key], c.remote[key]);
  assert.equal(c.uploads(), 0);
});

test("edit requested after delete never recreates the deleted immutable photo ID", async () => {
  const f = fixture(); await f.api.deletePhoto("p");
  await assert.rejects(f.api.saveEditedPhoto(editInput));
  assert.equal((await f.api.getPhotos()).length, 0);
});
for (const [name, file, key, restore, stale, latest] of [
  ["photo", "lib/legacy-photo-library.ts", photoKey, "restorePhotoOriginalIfNeeded", { ...oldPhoto, localFileStatus: "cloud_only", uri: "https://old" }, { ...oldPhoto, sequence: 3, updatedAt: "2026-11-03", uri: "file:///rendered.jpg" }],
  ["image work", "lib/work-library.ts", "travel-frame.image-bundles.v1", "restoreImageBundleWorkIfNeeded", { id: "w", createdAt: "2026-10-01", imageUris: ["https://old"] }, { id: "w", createdAt: "2026-10-01", imageUris: ["file:///rendered.jpg"], title: "Latest title" }],
  ["video", "lib/video-library.ts", "travel-frame.videos.v1", "restoreMadeVideoIfNeeded", { id: "v", createdAt: "2026-10-01", uri: "https://old" }, { id: "v", createdAt: "2026-10-01", uri: "file:///docs/made-videos/v.mp4", title: "Latest title" }]
]) test(`${name} restoring an old caller snapshot does not overwrite latest local edits`, async () => {
  const f = fixture(); f.storage.set(key, JSON.stringify([latest])); f.files.set(latest.uri ?? latest.imageUris[0], "new content");
  const api = load(file, f.dependencies); await api[restore](stale);
  const persisted = JSON.parse(f.storage.get(key))[0];
  assert.equal(persisted.uri ?? persisted.imageUris[0], latest.uri ?? latest.imageUris[0]);
  assert.equal(persisted.title, latest.title); assert.equal(persisted.sequence, latest.sequence);
});


test("cloud restore paused at project merge preserves a completed project capture, edit and deletion", async () => {
  const f = fixture(); const reached = barrier(), resume = barrier();
  const c = cloudFixture(f, { mergeProjects: async () => { reached.resolve(); await resume.promise; } });
  c.documents.set("photoBackups/deleted", { ...c.remote, localId: "deleted" });
  const photo = load("lib/photo-library.ts", {
    "@/lib/legacy-photo-library": f.api,
    "@/lib/body-frame-camera-session": { finishBodyFrameCameraCapture: () => {} },
    "@/lib/body-project-library": { updateBodyProject: async () => {} },
    "@/lib/body-measurement-library": {},
    "@/lib/body-frame-photo-storage": { storeBodyFramePhotoFile: async ({ photoId }) => {
      const uri = `file:///docs/project/${photoId}.jpg`, previewUri = `file:///docs/project/${photoId}-preview.jpg`;
      f.files.set(uri, "capture"); f.files.set(previewUri, "capture preview");
      return { uri, previewUri, width: 100, height: 100 };
    } }
  });
  const restoring = c.api.restoreCloudBackupToLocal({ user: c.user }); await reached.promise;
  const captured = await photo.saveCapturedPhoto({ uri: "file:///camera.jpg", width: 100, height: 100 }, { projectId: "pr", sequence: 2, reservationId: "r" });
  // The editor supplies a newly rendered file after capture's staging cleanup.
  f.files.set("file:///rendered.jpg", "edit");
  const edited = await f.api.saveEditedPhoto(editInput);
  await f.api.deletePhoto("deleted");
  resume.resolve(); const counts = await restoring;
  const photos = await f.api.getPhotos();
  assert.equal(photos.find(item => item.id === "p").uri, edited.uri);
  assert.equal(photos.find(item => item.id === captured.id).uri, captured.uri);
  assert.ok(f.files.has(captured.uri)); assert.ok(f.files.has(edited.uri));
  assert.equal(photos.some(item => item.id === "deleted"), false);
  assert.equal(counts.photoCount, 0);
});
