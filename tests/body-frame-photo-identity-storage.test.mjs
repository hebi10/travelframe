import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const load = (file, dependencies = {}) => {
  const source = fs.readFileSync(file, "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const context = {
    exports: {},
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    }
  };
  vm.runInNewContext(code, context, { filename: file });
  return context.exports;
};

const utils = load("lib/body-frame-stage2-utils.ts");

test("photo identity paths are independent of changed display sequences", () => {
  const pathById = (id) => utils.buildProjectPhotoIdRelativePath("project-1", id);
  const original = ["photo-a", "photo-b", "photo-c"];
  const reordered = ["photo-c", "photo-a", "photo-b"];
  assert.equal(new Set(original.map(pathById)).size, 3);
  assert.deepEqual(reordered.map(pathById), [
    pathById("photo-c"), pathById("photo-a"), pathById("photo-b")
  ]);
  assert.notEqual(pathById("photo-d"), utils.buildProjectPhotoRelativePath("project-1", 3));
  assert.notEqual(
    utils.buildProjectPreviewIdRelativePath("project-1", "photo-d"),
    utils.buildProjectPreviewRelativePath("project-1", 3)
  );
  assert.throws(() => utils.formatProjectPhotoIdFileName("../unsafe"));
});

const createFakeStorage = () => {
  const files = new Map();
  let previewCounter = 0;
  const fileSystem = {
    documentDirectory: "file:///documents/",
    makeDirectoryAsync: async () => {},
    getInfoAsync: async (uri) =>
      files.has(uri) ? { exists: true, md5: files.get(uri) } : { exists: false },
    copyAsync: async ({ from, to }) => {
      if (!files.has(from)) throw new Error(`Missing fake source ${from}`);
      files.set(to, files.get(from));
    },
    moveAsync: async ({ from, to }) => {
      if (!files.has(from)) throw new Error(`Missing temp file ${from}`);
      if (files.has(to)) throw new Error("Refusing fake overwrite");
      files.set(to, files.get(from));
      files.delete(from);
    },
    deleteAsync: async (uri) => {
      files.delete(uri);
    }
  };
  const manipulation = {
    SaveFormat: { JPEG: "jpeg" },
    manipulateAsync: async (uri) => {
      const output = `file:///tmp/preview-${++previewCounter}.jpg`;
      files.set(output, `preview:${files.get(uri)}`);
      return { uri: output };
    }
  };
  const storage = load("lib/body-frame-photo-storage.ts", {
    "expo-file-system/legacy": fileSystem,
    "expo-image-manipulator": manipulation,
    "@/constants/body-frame": { BODY_FRAME_MEDIA_POLICY: { previewMaxLongSide: 1080, previewJpegQuality: 0.8 } },
    "@/lib/body-frame-stage2-utils": utils,
    "@/lib/image-backup-utils": { optimizeBodyFramePhotoForStorage: async ({ uri, width, height }) => ({
      uri, width, height, imageQuality: "standard", quality: 0.8, size: 100, originalSize: 120
    }) }
  });
  return { files, storage };
};

test("new captures preserve existing numbered originals and previews", async () => {
  const { files, storage } = createFakeStorage();
  const oldPhoto = "file:///documents/photos/project-1/003.jpg";
  const oldPreview = "file:///documents/photo-previews/project-1/003.jpg";
  files.set(oldPhoto, "precious-old-original");
  files.set(oldPreview, "precious-old-preview");
  files.set("file:///source-new.jpg", "new-picture");

  const created = await storage.storeBodyFramePhotoFile({
    sourceUri: "file:///source-new.jpg", projectId: "project-1",
    photoId: "new-photo-id", width: 1200, height: 1600
  });

  assert.equal(files.get(oldPhoto), "precious-old-original");
  assert.equal(files.get(oldPreview), "precious-old-preview");
  assert.match(created.uri, /photo-new-photo-id\.jpg$/);
  assert.equal(files.get(created.uri), "new-picture");
  assert.equal(files.get(created.previewUri), "preview:new-picture");
});

test("different bytes at an existing photo identity are never overwritten", async () => {
  const { files, storage } = createFakeStorage();
  files.set("file:///source-a.jpg", "first");
  files.set("file:///source-b.jpg", "second");
  const first = await storage.storeBodyFramePhotoFile({
    sourceUri: "file:///source-a.jpg", projectId: "project-1",
    photoId: "same-id", width: 1200, height: 1600
  });
  await assert.rejects(
    () => storage.storeBodyFramePhotoFile({
      sourceUri: "file:///source-b.jpg", projectId: "project-1",
      photoId: "same-id", width: 1200, height: 1600
    }),
    /기존 사진을 보호/
  );
  assert.equal(files.get(first.uri), "first");
  assert.equal(files.get(first.previewUri), "preview:first");
});

test("migration copies to stable ID paths before cleaning original files", async () => {
  const { files, storage } = createFakeStorage();
  const oldUri = "file:///documents/photos/project-1/008.jpg";
  const oldPreview = "file:///documents/photo-previews/project-1/008.jpg";
  files.set(oldUri, "old-original");
  files.set(oldPreview, "old-preview");

  const migrated = await storage.migratePhotoFilesToProject({
    id: "legacy-photo", uri: oldUri, previewUri: oldPreview,
    localUri: oldUri, localPreviewUri: oldPreview,
    projectId: "project-1", sequence: 8
  });
  assert.match(migrated.photo.uri, /photo-legacy-photo\.jpg$/);
  assert.match(migrated.photo.previewUri, /photo-legacy-photo\.jpg$/);
  assert.equal(files.get(migrated.photo.uri), "old-original");
  assert.equal(files.get(oldUri), "old-original");
  assert.equal(files.get(oldPreview), "old-preview");
  assert.deepEqual([...migrated.obsoleteSourceUris], [oldUri, oldPreview]);
  await storage.cleanupMigratedSourceFiles(migrated.obsoleteSourceUris);
  assert.equal(files.has(oldUri), false);
  assert.equal(files.get(migrated.photo.uri), "old-original");
});
