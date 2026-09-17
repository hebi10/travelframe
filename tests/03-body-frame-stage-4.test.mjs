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
    `body-frame-stage4-${path.basename(filePath).replace(/\W+/g, "-")}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`
  );
  fs.writeFileSync(tempPath, output);
  return import(pathToFileURL(tempPath).href);
};

const video = await importTsModule("lib/body-frame-video.ts");

assert.equal(video.BODY_FRAME_VIDEO_FPS, 30);
assert.equal(video.BODY_FRAME_VIDEO_FRAMES_PER_PHOTO, 3);
assert.equal(video.BODY_FRAME_VIDEO_SECONDS_PER_PHOTO, 0.1);
assert.equal(video.BODY_FRAME_VIDEO_RATIO, "9:16");
assert.equal(video.BODY_FRAME_VIDEO_TEMPLATE, "minimal");
assert.equal(video.BODY_FRAME_VIDEO_TRANSITION, "none");
assert.equal(video.BODY_FRAME_VIDEO_TRANSITION_DURATION, 0);
assert.deepEqual(video.BODY_FRAME_VIDEO_MAX_OUTPUT_SIZE, {
  width: 1080,
  height: 1920
});

assert.equal(video.getBodyFrameVideoDuration(100), 10);
assert.equal(video.getBodyFrameVideoTotalFrames(100), 300);
assert.equal(video.getBodyFrameVideoDuration(365), 36.5);
assert.equal(video.getBodyFrameVideoTotalFrames(365), 1095);
assert.equal(video.getBodyFrameVideoDuration(-1), 0);
assert.equal(video.getBodyFrameVideoTotalFrames(Number.NaN), 0);

const photos = [
  {
    id: "a-3",
    uri: "file:///a-3.jpg",
    createdAt: "2026-09-03T00:00:00.000Z",
    projectId: "project-a",
    sequence: 3
  },
  {
    id: "a-1",
    uri: "file:///a-1.jpg",
    createdAt: "2026-09-01T00:00:00.000Z",
    projectId: "project-a",
    sequence: 1
  },
  {
    id: "b-1",
    uri: "file:///b-1.jpg",
    createdAt: "2026-09-01T00:00:00.000Z",
    projectId: "project-b",
    sequence: 1
  },
  {
    id: "a-2",
    uri: "file:///a-2.jpg",
    createdAt: "2026-09-02T00:00:00.000Z",
    projectId: "project-a",
    sequence: 2
  }
];

const projectPhotos = video.getBodyFrameVideoPhotos(photos, "project-a");
assert.deepEqual(projectPhotos.map((photo) => photo.id), ["a-1", "a-2", "a-3"]);
assert.deepEqual(video.createBodyFrameVideoDurations(projectPhotos), {
  "a-1": 0.1,
  "a-2": 0.1,
  "a-3": 0.1
});

const routeSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");
assert.ok(
  routeSource.includes("BodyFrameVideoScreen"),
  "video tab should use BodyFrameVideoScreen"
);

const screenSource = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "utf8"
);
for (const token of [
  "getBodyProjects",
  "getLastActiveProjectId",
  "setLastActiveProjectId",
  "selectActiveBodyProject",
  "getBodyFrameVideoPhotos",
  "createBodyFrameVideoDurations",
  "getBodyFrameVideoDuration",
  "getBodyFrameVideoTotalFrames",
  "BODY_FRAME_VIDEO_FPS",
  "BODY_FRAME_VIDEO_MAX_OUTPUT_SIZE",
  "BODY_FRAME_VIDEO_RATIO",
  "BODY_FRAME_VIDEO_TRANSITION",
  "BODY_FRAME_VIDEO_TRANSITION_DURATION",
  "TripClipRecordingCanvas",
  "OptionalRecordingView",
  "useOptionalViewRecorder",
  "getRecordingFrame",
  "saveVideoToLibrary",
  "saveMadeVideo",
  "fps: BODY_FRAME_VIDEO_FPS",
  "codec: \"h264\"",
  "projectId: activeProject.id"
]) {
  assert.ok(screenSource.includes(token), `Body Frame video screen should contain ${token}`);
}

const videoTypeSource = fs.readFileSync("types/video.ts", "utf8");
assert.ok(videoTypeSource.includes("projectId?: string"));

const videoLibrarySource = fs.readFileSync("lib/video-library.ts", "utf8");
assert.ok(videoLibrarySource.includes("projectId:"));

console.log("ok - Body Frame stage 4 exact project video contracts are enforced");
