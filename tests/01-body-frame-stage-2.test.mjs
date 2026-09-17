import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const importTsModule = async (filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const tempPath = path.join(
    os.tmpdir(),
    `body-frame-stage2-${path.basename(filePath).replace(/\W+/g, "-")}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`
  );

  fs.writeFileSync(tempPath, output);
  return import(pathToFileURL(tempPath).href);
};

const utils = await importTsModule("lib/body-frame-stage2-utils.ts");

assert.equal(utils.LEGACY_BODY_PROJECT_ID, "legacy-photos");
assert.equal(utils.LEGACY_BODY_PROJECT_NAME, "기존 사진");
assert.equal(utils.formatProjectSequenceFileName(1), "001.jpg");
assert.equal(utils.formatProjectSequenceFileName(99), "099.jpg");
assert.equal(utils.formatProjectSequenceFileName(100), "100.jpg");
assert.equal(utils.formatProjectSequenceFileName(1000), "1000.jpg");
assert.equal(utils.sanitizeProjectPathSegment("  project/../A  "), "project-A");
assert.equal(
  utils.buildProjectPhotoRelativePath(" project-a ", 7),
  "photos/project-a/007.jpg"
);
assert.equal(
  utils.buildProjectPreviewRelativePath(" project-a ", 7),
  "photo-previews/project-a/007.jpg"
);

const photos = [
  {
    id: "legacy-b",
    createdAt: "2026-01-02T00:00:00.000Z",
    uri: "file:///b.jpg"
  },
  {
    id: "assigned",
    createdAt: "2026-01-01T12:00:00.000Z",
    uri: "file:///assigned.jpg",
    projectId: "existing-project",
    sequence: 9
  },
  {
    id: "legacy-c",
    createdAt: "2026-01-02T00:00:00.000Z",
    uri: "file:///c.jpg"
  },
  {
    id: "legacy-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    uri: "file:///a.jpg"
  }
];

const assigned = utils.assignLegacyPhotosToProject(photos, utils.LEGACY_BODY_PROJECT_ID);
const byId = new Map(assigned.map((photo) => [photo.id, photo]));
assert.equal(byId.get("legacy-a").sequence, 1);
assert.equal(byId.get("legacy-b").sequence, 2);
assert.equal(byId.get("legacy-c").sequence, 3);
assert.equal(byId.get("legacy-a").projectId, "legacy-photos");
assert.equal(byId.get("legacy-b").projectId, "legacy-photos");
assert.equal(byId.get("legacy-c").projectId, "legacy-photos");
assert.equal(byId.get("assigned").projectId, "existing-project");
assert.equal(byId.get("assigned").sequence, 9);

const legacyProject = utils.buildLegacyBodyProject(assigned);
assert.equal(legacyProject.id, "legacy-photos");
assert.equal(legacyProject.name, "기존 사진");
assert.equal(legacyProject.targetPhotoCount, 100);
assert.equal(legacyProject.referenceMode, "latest");
assert.equal(legacyProject.coverPhotoId, "legacy-c");
assert.equal(legacyProject.archived, false);

const manyLegacyPhotos = Array.from({ length: 137 }, (_, index) => ({
  id: `photo-${String(index + 1).padStart(3, "0")}`,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
  uri: `file:///${index + 1}.jpg`,
  projectId: "legacy-photos",
  sequence: index + 1
}));
assert.equal(utils.buildLegacyBodyProject(manyLegacyPhotos).targetPhotoCount, 137);

const projectLibrarySource = fs.readFileSync("lib/body-project-library.ts", "utf8");
for (const token of [
  'BODY_PROJECT_STORAGE_KEY = "body-frame.projects.v1"',
  "getBodyProjects",
  "getBodyProjectById",
  "createBodyProject",
  "updateBodyProject",
  "archiveBodyProject",
  "replaceBodyProjects"
]) {
  assert.ok(projectLibrarySource.includes(token), `project library should contain ${token}`);
}

const storageSource = fs.readFileSync("lib/body-frame-photo-storage.ts", "utf8");
for (const token of [
  "buildProjectPhotoRelativePath",
  "buildProjectPreviewRelativePath",
  "optimizeBodyFramePhotoForStorage",
  "BODY_FRAME_MEDIA_POLICY.previewJpegQuality",
  "storeBodyFramePhotoFile",
  "migratePhotoFilesToProject",
  "cleanupMigratedSourceFiles"
]) {
  assert.ok(storageSource.includes(token), `Body Frame photo storage should contain ${token}`);
}
assert.ok(
  storageSource.includes(".migrating") &&
    storageSource.indexOf("FileSystem.copyAsync") < storageSource.indexOf("FileSystem.moveAsync"),
  "project file replacement should copy through a temporary file before final move"
);

const photoTypeSource = fs.readFileSync("types/photo.ts", "utf8");
for (const token of ["projectId?: string", "sequence?: number"]) {
  assert.ok(photoTypeSource.includes(token), `photo types should contain ${token}`);
}

const migrationSource = fs.readFileSync("lib/body-frame-stage2-migration.ts", "utf8");
for (const token of [
  'BODY_FRAME_STAGE2_MIGRATION_KEY = "body-frame.stage-2-migration.v1"',
  "ensureBodyFrameStage2Migration",
  "LEGACY_BODY_PROJECT_ID",
  "replaceBodyProjects",
  "replacePhotosFromBackup",
  "setLastActiveProjectId"
]) {
  assert.ok(migrationSource.includes(token), `migration should contain ${token}`);
}
const persistProjectsIndex = migrationSource.indexOf("await replaceBodyProjects");
const persistPhotosIndex = migrationSource.indexOf("await replacePhotosFromBackup");
const cleanupIndex = migrationSource.indexOf("await cleanupMigratedSourceFiles");
assert.ok(persistProjectsIndex >= 0, "migration should persist project metadata");
assert.ok(persistPhotosIndex > persistProjectsIndex, "migration should persist photos after projects");
assert.ok(cleanupIndex > persistPhotosIndex, "source cleanup must happen only after metadata persistence");

const imageUtilsSource = fs.readFileSync("lib/image-backup-utils.ts", "utf8");
for (const token of [
  "optimizeBodyFramePhotoForStorage",
  "BODY_FRAME_MEDIA_POLICY.appImageMaxLongSide",
  "BODY_FRAME_MEDIA_POLICY.appImageJpegQuality"
]) {
  assert.ok(imageUtilsSource.includes(token), `image utils should contain ${token}`);
}

const layoutSource = fs.readFileSync("app/_layout.tsx", "utf8");
assert.ok(
  layoutSource.includes("ensureBodyFrameStage2Migration") &&
    layoutSource.includes("void ensureBodyFrameStage2Migration()"),
  "app startup should trigger Stage 2 migration"
);

console.log("ok - Body Frame stage 2 project, storage, and migration contracts are enforced");
