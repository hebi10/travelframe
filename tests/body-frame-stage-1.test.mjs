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
    `body-frame-${path.basename(filePath).replace(/\W+/g, "-")}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`
  );

  fs.writeFileSync(tempPath, output);
  return import(pathToFileURL(tempPath).href);
};

const policy = await importTsModule("constants/body-frame.ts");
assert.deepEqual(policy.BODY_FRAME_FREE_LIMITS, {
  maxProgressPhotos: 100,
  maxProgressVideoSeconds: 10
});
assert.deepEqual(policy.BODY_FRAME_PROGRESS_POLICY, {
  secondsPerPhoto: 0.1,
  fps: 30,
  framesPerPhoto: 3
});
assert.deepEqual(policy.BODY_FRAME_MEDIA_POLICY, {
  appImageMaxLongSide: 2560,
  appImageJpegQuality: 0.85,
  previewMaxLongSide: 1080,
  previewJpegQuality: 0.74
});
assert.equal(policy.BODY_FRAME_DEFAULT_REFERENCE_MODE, "latest");

const normalization = await importTsModule("lib/body-frame-normalization.ts");
assert.equal(normalization.normalizeReferencePhotoMode("first"), "first");
assert.equal(normalization.normalizeReferencePhotoMode("latest"), "latest");
assert.equal(normalization.normalizeReferencePhotoMode("legacy"), "latest");
assert.equal(normalization.normalizeReferencePhotoMode(null), "latest");

const legacyPhoto = {
  id: "legacy-1",
  uri: "file:///legacy.jpg",
  createdAt: "2026-01-01T00:00:00.000Z"
};
assert.deepEqual(normalization.normalizeStoredPhotoItem(legacyPhoto), legacyPhoto);
assert.deepEqual(
  normalization.normalizeStoredPhotoItem({
    ...legacyPhoto,
    projectId: "  project-1  ",
    sequence: 4
  }),
  {
    ...legacyPhoto,
    projectId: "project-1",
    sequence: 4
  }
);
assert.deepEqual(
  normalization.normalizeStoredPhotoItem({
    ...legacyPhoto,
    projectId: "   ",
    sequence: 0
  }),
  legacyPhoto
);
assert.equal(normalization.normalizeStoredPhotoItem(null), null);
assert.equal(normalization.normalizeStoredPhotoItem([]), null);

assert.equal(normalization.normalizeLastActiveProjectId(" project-2 "), "project-2");
assert.equal(normalization.normalizeLastActiveProjectId("   "), null);
assert.equal(normalization.normalizeLastActiveProjectId(null), null);
assert.equal(normalization.normalizeLastActiveProjectId(123), null);

const projectTypeSource = fs.readFileSync("types/body-project.ts", "utf8");
for (const token of [
  'export type ReferencePhotoMode = "first" | "latest"',
  "export type BodyProject",
  "targetPhotoCount: number",
  "referenceMode: ReferencePhotoMode",
  "coverPhotoId?: string",
  "archived: boolean"
]) {
  assert.ok(projectTypeSource.includes(token), `types/body-project.ts should contain ${token}`);
}

const photoTypeSource = fs.readFileSync("types/photo.ts", "utf8");
assert.ok(photoTypeSource.includes("projectId?: string"), "PhotoItem should support legacy-compatible projectId");
assert.ok(photoTypeSource.includes("sequence?: number"), "PhotoItem should support legacy-compatible sequence");

const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
assert.ok(
  photoLibrarySource.includes("normalizeStoredPhotoItem"),
  "photo library should normalize stored photos before returning them"
);

const preferencesSource = fs.readFileSync("lib/body-project-preferences.ts", "utf8");
for (const token of [
  'LAST_ACTIVE_PROJECT_ID_STORAGE_KEY = "body-frame.last-active-project-id.v1"',
  "getLastActiveProjectId",
  "setLastActiveProjectId",
  "clearLastActiveProjectId",
  "normalizeLastActiveProjectId"
]) {
  assert.ok(preferencesSource.includes(token), `body project preferences should contain ${token}`);
}

const entitlementsSource = fs.readFileSync("lib/plan-entitlements.ts", "utf8");
for (const token of [
  "maxProgressPhotos: number | null",
  "maxProgressVideoSeconds: number | null",
  "maxProjectCount: number | null",
  "maxProgressPhotos: BODY_FRAME_FREE_LIMITS.maxProgressPhotos",
  "maxProgressVideoSeconds: BODY_FRAME_FREE_LIMITS.maxProgressVideoSeconds",
  "maxProgressPhotos: BODY_FRAME_PRO_MINIMUMS.maxProgressPhotos",
  "maxProgressVideoSeconds: BODY_FRAME_PRO_MINIMUMS.maxProgressVideoSeconds"
]) {
  assert.ok(entitlementsSource.includes(token), `plan entitlements should contain ${token}`);
}

console.log("ok - Body Frame stage 1 data and policy contracts are enforced");
