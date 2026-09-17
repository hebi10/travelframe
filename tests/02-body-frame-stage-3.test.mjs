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
    `body-frame-stage3-${path.basename(filePath).replace(/\W+/g, "-")}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`
  );
  fs.writeFileSync(tempPath, output);
  return import(pathToFileURL(tempPath).href);
};

const cameraProject = await importTsModule("lib/body-frame-camera-project.ts");

const projects = [
  {
    id: "project-a",
    name: "바디프로필 준비",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    targetPhotoCount: 100,
    referenceMode: "latest",
    archived: false
  },
  {
    id: "project-b",
    name: "365일 변화",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
    targetPhotoCount: 365,
    referenceMode: "first",
    archived: false
  },
  {
    id: "project-c",
    name: "보관됨",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    targetPhotoCount: 100,
    referenceMode: "latest",
    archived: true
  }
];

assert.equal(cameraProject.selectActiveBodyProject(projects, "project-b")?.id, "project-b");
assert.equal(cameraProject.selectActiveBodyProject(projects, "project-c")?.id, "project-a");
assert.equal(cameraProject.selectActiveBodyProject(projects, "missing")?.id, "project-a");
assert.equal(cameraProject.selectActiveBodyProject([], "project-a"), null);

const photos = [
  {
    id: "a-1",
    uri: "file:///a-1.jpg",
    createdAt: "2026-09-01T00:00:00.000Z",
    projectId: "project-a",
    sequence: 1
  },
  {
    id: "a-3",
    uri: "file:///a-3.jpg",
    createdAt: "2026-09-03T00:00:00.000Z",
    projectId: "project-a",
    sequence: 3
  },
  {
    id: "a-invalid",
    uri: "file:///invalid.jpg",
    createdAt: "2026-09-04T00:00:00.000Z",
    projectId: "project-a",
    sequence: 0
  },
  {
    id: "b-1",
    uri: "https://example.com/b-1.jpg",
    downloadURL: "https://example.com/download-b-1.jpg",
    createdAt: "2026-08-02T00:00:00.000Z",
    projectId: "project-b",
    sequence: 1
  }
];

assert.deepEqual(
  cameraProject.getBodyProjectPhotos(photos, "project-a").map((photo) => photo.id),
  ["a-1", "a-3", "a-invalid"]
);
assert.equal(cameraProject.getNextBodyProjectSequence(photos, "project-a"), 4);
assert.equal(cameraProject.getNextBodyProjectSequence(photos, "project-b"), 2);
assert.equal(cameraProject.getNextBodyProjectSequence(photos, "missing"), 1);

assert.equal(
  cameraProject.selectBodyProjectReferencePhoto(photos, projects[0])?.id,
  "a-3"
);
assert.equal(
  cameraProject.selectBodyProjectReferencePhoto(photos, projects[1])?.id,
  "b-1"
);
assert.equal(
  cameraProject.selectBodyProjectReferencePhoto([], projects[0]),
  null
);

const summary = cameraProject.getBodyProjectProgressSummary(photos, projects[0]);
assert.equal(summary.photoCount, 3);
assert.equal(summary.targetPhotoCount, 100);
assert.equal(summary.durationSeconds, 0.3);
assert.equal(summary.nextSequence, 4);

const cameraSource = fs.readFileSync(
  "features/camera/BodyFrameCameraScreen.tsx",
  "utf8"
);
for (const token of [
  "BodyFrameProjectSwitcher",
  "getBodyProjects",
  "getLastActiveProjectId",
  "setLastActiveProjectId",
  "selectActiveBodyProject",
  "selectBodyProjectReferencePhoto",
  "getNextBodyProjectSequence",
  "projectId: activeProject.id",
  "sequence: nextProjectSequence",
  "번째 사진을 저장했습니다.",
  "첫 사진을 찍어 기준을 만들어주세요."
]) {
  assert.ok(cameraSource.includes(token), `camera screen should contain ${token}`);
}

const switcherSource = fs.readFileSync(
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "utf8"
);
for (const token of [
  "프로젝트 선택",
  "+ 새 프로젝트",
  "최근 사진",
  "첫 번째 사진",
  "100",
  "365"
]) {
  assert.ok(switcherSource.includes(token), `project switcher should contain ${token}`);
}

const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
for (const token of [
  "storeBodyFramePhotoFile",
  "projectId",
  "sequence",
  "projectId: resolvedProjectId",
  "sequence: resolvedSequence"
]) {
  assert.ok(photoLibrarySource.includes(token), `project-aware photo save should contain ${token}`);
}

console.log("ok - Body Frame stage 3 camera and project contracts are enforced");
