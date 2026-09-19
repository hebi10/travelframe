import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const loadModule = (file, dependencies = {}) => {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const context = { exports: {}, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(output, context, { filename: file });
  return context.exports;
};

test("later migrations allocate after the target project's highest sequence", () => {
  const utils = loadModule("lib/body-frame-stage2-utils.ts");
  const photos = [
    { id: "existing", projectId: "legacy-photos", sequence: 7, createdAt: "2026-01-01" },
    { id: "other-project", projectId: "other", sequence: 99, createdAt: "2026-01-01" },
    { id: "newer", createdAt: "2026-03-01" },
    { id: "older", createdAt: "2026-02-01" }
  ];
  const result = utils.assignLegacyPhotosToProject(photos);
  assert.equal(result.find((photo) => photo.id === "older").sequence, 8);
  assert.equal(result.find((photo) => photo.id === "newer").sequence, 9);
  assert.equal(result[0], photos[0]);
  assert.equal(result[1], photos[1]);
  const paths = result.map((photo) => utils.buildProjectPhotoRelativePath(photo.projectId, photo.sequence));
  assert.equal(new Set(paths).size, photos.length);
  assert.equal(JSON.stringify(utils.assignLegacyPhotosToProject(result)), JSON.stringify(result));
});

test("overwriting an edited photo keeps its project and backup identity", async () => {
  const previous = {
    id: "edited", uri: "file:///old.jpg", previewUri: "file:///old-preview.jpg",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
    width: 100, height: 100, kind: "edited", edited: true, addedToVideo: true,
    projectId: "legacy-photos", sequence: 7, storagePath: "users/test/photo.jpg",
    downloadURL: "https://example.test/photo.jpg", sourceDeviceId: "device",
    localUri: "file:///old.jpg", backupStatus: "backed_up", localFileStatus: "cloud_only"
  };
  const store = new Map([["travel-frame.photos.v1", JSON.stringify([previous])]]);
  const library = loadModule("lib/legacy-photo-library.ts", {
    "expo-file-system/legacy": {
      documentDirectory: "file:///documents/", makeDirectoryAsync: async () => {},
      copyAsync: async () => {}, deleteAsync: async () => {}
    },
    "expo-image-manipulator": { SaveFormat: { JPEG: "jpeg" }, manipulateAsync: async () => ({ uri: "file:///rendered-preview.jpg" }) },
    "@/lib/local-storage": { localStorageAdapter: {
      getItem: async (key) => store.get(key) ?? null,
      setItem: async (key, value) => { store.set(key, value); }
    } },
    "@/lib/local-library-limit": { assertLocalLibraryCapacity: () => {} },
    "@/lib/image-backup-utils": { optimizeImageForStorage: async (input) => ({ ...input, imageQuality: "standard", quality: 0.8, size: 10 }) },
    "@/lib/android-image-adjustment": {},
    "@/lib/app-settings": { getAppSettings: async () => ({ imageBackupQuality: "standard" }) },
    "@/lib/trip-clip-export": {}
  });
  const photo = await library.saveEditedPhoto({
    sourceUri: previous.uri, targetPhotoId: previous.id, renderedUri: "file:///new.jpg",
    renderedWidth: 100, renderedHeight: 100,
    transform: { ratioLabel: "1:1", translateX: 0, translateY: 0, rotation: 0, scale: 1 }
  });
  for (const field of ["projectId", "sequence", "storagePath", "downloadURL", "sourceDeviceId", "createdAt"]) {
    assert.equal(photo[field], previous[field], `${field} should survive overwrite`);
  }
  assert.equal(photo.localUri, photo.uri);
  assert.equal(photo.localPreviewUri, photo.previewUri);
  assert.equal(photo.localFileStatus, "available");
  assert.equal(photo.backupStatus, "pending");
  assert.ok(Date.parse(photo.updatedAt) > Date.parse(previous.updatedAt));
  assert.equal(JSON.parse(store.get("travel-frame.photos.v1"))[0].projectId, previous.projectId);

  const copy = await library.saveEditedPhoto({
    sourceUri: photo.uri, sourcePhotoId: photo.id, renderedUri: "file:///copy.jpg",
    renderedWidth: 100, renderedHeight: 100,
    transform: { ratioLabel: "1:1", translateX: 0, translateY: 0, rotation: 0, scale: 1 }
  });
  assert.notEqual(copy.id, photo.id);
  assert.equal(copy.sourcePhotoId, photo.id);
  assert.equal(copy.projectId, undefined, "a new copy keeps the existing unassigned policy");
  assert.equal(copy.sequence, undefined);
  assert.equal(copy.storagePath, undefined, "a new copy must not inherit the source's remote identity");
});
