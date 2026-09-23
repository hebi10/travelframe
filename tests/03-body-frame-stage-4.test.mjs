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
assert.equal(video.BODY_FRAME_VIDEO_RATIO, "3:4");
assert.equal(video.BODY_FRAME_VIDEO_TEMPLATE, "minimal");
assert.equal(video.BODY_FRAME_VIDEO_TRANSITION, "none");
assert.equal(video.BODY_FRAME_VIDEO_TRANSITION_DURATION, 0);
assert.deepEqual(video.DEFAULT_BODY_FRAME_VIDEO_OPTIONS, {
  interval: 0.1,
  quality: 1080,
  ratio: "3:4",
  overlay: {
    showDate: false,
    showWeight: false,
    showBodyFat: false,
    customText: "",
    position: "bottom-right"
  }
});
assert.deepEqual(video.BODY_FRAME_VIDEO_MAX_OUTPUT_SIZE, {
  width: 1080,
  height: 1440
});

assert.equal(video.getBodyFrameVideoDuration(100), 10);
assert.equal(video.getBodyFrameVideoTotalFrames(100), 300);
assert.equal(video.getBodyFrameVideoDuration(365), 36.5);
assert.equal(video.getBodyFrameVideoTotalFrames(365), 1095);
assert.equal(video.getBodyFrameVideoDuration(-1), 0);
assert.equal(video.getBodyFrameVideoTotalFrames(Number.NaN), 0);
for (const interval of [0.1, 0.2, 0.5, 1]) {
  assert.equal(video.getBodyFrameVideoTotalFrames(365, interval), 365 * interval * 30);
  assert.equal(video.getBodyFrameVideoDuration(100, interval), 100 * interval);
  const frames = interval * 30;
  assert.equal(video.getBodyFrameVideoPhotoIndex(frames - 1, interval), 0);
  assert.equal(video.getBodyFrameVideoPhotoIndex(frames, interval), 1);
}
assert.deepEqual(video.getBodyFrameVideoOutputSize("9:16", 720), { width: 720, height: 1280 });
assert.deepEqual(video.getBodyFrameVideoOutputSize("3:4", 720), { width: 720, height: 960 });
assert.deepEqual(video.getBodyFrameVideoOutputSize("3:4", 1080), { width: 1080, height: 1440 });
assert.deepEqual(video.getBodyFrameVideoOutputSize("1:1", 1080), { width: 1080, height: 1080 });
assert.deepEqual(video.getBodyFrameVideoOutputSize("16:9", 1080), { width: 1920, height: 1080 });
assert.equal(video.getBodyFrameVideoDuration(0, 1), 0);
assert.equal(
  video.formatBodyFrameVideoOverlayDate("2026-09-22T12:00:00+09:00"),
  "26.09.22"
);
assert.equal(
  video.getBodyFrameVideoOverlayText({
    photo: { createdAt: "2026-09-22T12:00:00+09:00" },
    measurement: { weightKg: 72.4, bodyFatPercent: 18.2 },
    overlay: {
      showDate: true,
      showWeight: true,
      showBodyFat: true,
      customText: "",
      position: "bottom-right"
    }
  }),
  "26.09.22 · 72.4kg · 18.2%"
);
assert.equal(
  video.getBodyFrameVideoOverlayText({
    photo: { createdAt: "2026-09-22T12:00:00+09:00" },
    measurement: null,
    overlay: video.DEFAULT_BODY_FRAME_VIDEO_OVERLAY
  }),
  "",
  "metadata overlay must be off by default"
);
assert.equal(
  video.getBodyFrameVideoOverlayText({
    photo: { createdAt: "2026-09-22T12:00:00+09:00" },
    measurement: {
      recordedAt: "2026-09-20T12:00:00+09:00",
      weightKg: 72.4,
      bodyFatPercent: 18.2
    },
    overlay: {
      showDate: true,
      showWeight: false,
      showBodyFat: false,
      customText: "",
      position: "bottom-right"
    }
  }),
  "26.09.20",
  "editable record date should take precedence over the photo capture date"
);

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
assert.deepEqual(video.selectBodyFrameVideoPhotos(projectPhotos, ["a-3", "a-1", "b-1"]).map(photo => photo.id), ["a-1", "a-3"]);
assert.deepEqual(video.selectBodyFrameVideoPhotos(projectPhotos, []), []);
assert.deepEqual(video.selectBodyFrameVideoPhotos(projectPhotos, null), projectPhotos);
assert.equal(video.getBodyFrameVideoDuration(video.selectBodyFrameVideoPhotos(projectPhotos, ["a-3", "a-1"]).length, 0.5), 1);
assert.deepEqual(video.createBodyFrameVideoDurations(projectPhotos), {
  "a-1": 0.1,
  "a-2": 0.1,
  "a-3": 0.1
});
assert.deepEqual(video.createBodyFrameVideoDurations(projectPhotos.slice(1), 0.5), {
  "a-2": 0.5, "a-3": 0.5
});

const malformedPhotos = [
  {
    id: "legacy-early",
    uri: "file:///legacy-early.jpg",
    createdAt: "2026-01-01T00:00:00.000Z",
    projectId: "project-a"
  },
  {
    id: "valid-2",
    uri: "file:///valid-2.jpg",
    createdAt: "2026-09-02T00:00:00.000Z",
    projectId: "project-a",
    sequence: 2
  },
  {
    id: "valid-1",
    uri: "file:///valid-1.jpg",
    createdAt: "2026-09-01T00:00:00.000Z",
    projectId: "project-a",
    sequence: 1
  },
  {
    id: "legacy-late",
    uri: "file:///legacy-late.jpg",
    createdAt: "2026-02-01T00:00:00.000Z",
    projectId: "project-a",
    sequence: 0
  }
];
assert.deepEqual(
  video.getBodyFrameVideoPhotos(malformedPhotos, "project-a").map((photo) => photo.id),
  ["valid-1", "valid-2", "legacy-early", "legacy-late"],
  "valid positive sequences must stay ahead of malformed legacy records"
);

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
  "DEFAULT_BODY_FRAME_VIDEO_OPTIONS",
  "getBodyFrameVideoOutputSize",
  "BODY_FRAME_VIDEO_TRANSITION",
  "BODY_FRAME_VIDEO_TRANSITION_DURATION",
  "TripClipRecordingCanvas",
  "OptionalRecordingView",
  "useOptionalViewRecorder",
  "getBodyFrameVideoPhotoIndex",
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

console.log("ok - Body Frame stage 4 exact project video contracts are enforced");
