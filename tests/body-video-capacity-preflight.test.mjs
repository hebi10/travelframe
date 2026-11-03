import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = fs.readFileSync("features/trip-clip/BodyFrameVideoScreen.tsx", "utf8");
const tree = ts.createSourceFile("screen.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
let recordCallback;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "createVideo") {
    callback = node.initializer.arguments[0].getText(tree);
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "recordProjectVideo") {
    recordCallback = node.initializer.arguments[0].getText(tree);
  }
  ts.forEachChild(node, visit);
};
visit(tree);
assert.ok(callback, "extract the real screen handler");
const compile = (code) => ts.transpileModule(code, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const limitExports = {};
vm.runInNewContext(compile(fs.readFileSync("lib/local-library-limit.ts", "utf8")), { exports: limitExports });

const runExport = async (storedCount, overrides = {}) => {
  const events = [];
  const messages = [];
  const exporting = [];
  const savedVideos = [];
  const albumRetries = [];
  const context = {
    exportController: { current: null },
    AbortController,
    assertBodyFrameExportActive: signal => { if (signal.aborted) throw new Error("취소되었습니다"); },
    FileSystem: { deleteAsync: async () => {} },
    setAlbumRetryUri: uri => albumRetries.push(uri),
    activeProject: { id: "a", name: "기록" },
    projectPhotos: [{ id: "photo", uri: "file:///photo.jpg" }],
    isExporting: false,
    planEntitlements: { canExportVideo: true, localVideoLimit: 30, weeklyVideoExportLimit: 0 },
    isLoggedIn: true,
    guestUsage: null,
    videoLimitState: { allowed: true },
    setIsExporting: (value) => exporting.push(value),
    setExportProgress: () => {},
    setMessage: (value) => messages.push(value),
    cancelPostSaveAd: () => {},
    requestPostSaveAd: () => { events.push("ad"); },
    getMadeVideos: async () => Array.from({ length: storedCount }),
    assertLocalLibraryCapacity: limitExports.assertLocalLibraryCapacity,
    recordProjectVideo: async () => { events.push("record"); return { uri: "file:///video.mp4", coverUri: "file:///cover.jpg", cleanup: async () => {} }; },
    saveVideoToLibrary: async () => { events.push("external-save"); },
    saveMadeVideo: async (video) => { events.push("app-save"); savedVideos.push(video); return { ...video, uri: "file:///persisted.mp4" }; },
    recordGuestWeeklyVideoExport: async () => ({ count: 1, remaining: 0 }),
    setGuestUsage: () => {},
    getUserFacingErrorMessage: (error) => error.message,
    previewPhoto: { uri: "file:///photo.jpg" },
    videoOptions: { ratio: "9:16", interval: 0.1, quality: 1080 },
    BODY_FRAME_VIDEO_TEMPLATE: "minimal",
    BODY_FRAME_VIDEO_TRANSITION: "none",
    BODY_FRAME_VIDEO_TRANSITION_DURATION: 0,
    durations: { photo: 0.1 },
    totalDuration: 0.1,
    formatDuration: (seconds) => `${seconds}초`,
    ...overrides
  };
  const handler = vm.runInNewContext(compile(`(${callback})`), context);
  await handler();
  return { events, messages, exporting, savedVideos, albumRetries };
};
const full = await runExport(30);
assert.deepEqual(full.events, [], "full storage must prevent native recording, every save and new ads");
assert.match(full.messages.at(-1), /영상 보관함 한도 30개/);
assert.deepEqual(full.exporting, [true, false], "failure must release the busy state");
const available = await runExport(29);
assert.deepEqual(available.events, ["record", "app-save", "external-save", "ad"]);
assert.match(available.messages.at(-1), /저장했습니다/);
assert.deepEqual((await runExport(0, { projectPhotos: [] })).events, [], "empty photo selection must not record or save");
const overDuration = await runExport(0, { videoLimitState: { allowed: false, limit: 10 }, totalDuration: 20 });
assert.deepEqual(overDuration.events, [], "longer intervals must respect the plan duration cap before recording");
assert.match(overDuration.messages.at(-1), /20초/);
const customized = await runExport(0, {
  videoOptions: { ratio: "16:9", interval: 0.5, quality: 720 },
  projectPhotos: [{ id: "one" }, { id: "three" }],
  durations: { one: 0.5, three: 0.5 },
  totalDuration: 1
});
assert.equal(customized.savedVideos[0].ratio, "16:9");
assert.equal(customized.savedVideos[0].duration, 1);
assert.deepEqual(Array.from(customized.savedVideos[0].photoIds), ["one", "three"]);
assert.deepEqual(customized.savedVideos[0].durations, { one: 0.5, three: 0.5 });

const albumFailure = await runExport(0, {
  saveVideoToLibrary: async () => { throw new Error("앨범 권한이 필요합니다"); }
});
assert.deepEqual(albumFailure.events, ["record", "app-save"], "album failure keeps the already encoded app video");
assert.match(albumFailure.messages.at(-1), /영상은 앱에 저장했습니다/);
assert.equal(albumFailure.albumRetries.at(-1), "file:///persisted.mp4", "retry uses the saved file without recording again");
const appFailure = await runExport(0, { saveMadeVideo: async () => { throw new Error("목록 저장 실패"); } });
assert.deepEqual(appFailure.events, ["record"], "do not export externally before durable app metadata succeeds");
const cancelledRecording = await runExport(0, { recordProjectVideo: async signal => {
  assert.equal(signal.aborted, false);
  throw new Error("취소되었습니다");
} });
assert.deepEqual(cancelledRecording.events, [], "cancelled recording never reaches either save destination");
assert.match(cancelledRecording.messages.at(-1), /취소/);

const videoHelpers = {};
vm.runInNewContext(compile(fs.readFileSync("lib/body-frame-video.ts", "utf8")), { exports: videoHelpers });
for (const ratio of ["3:4", "9:16", "1:1", "16:9"]) {
  for (const quality of [720, 1080]) {
    let nativeOptions;
    const outputSize = videoHelpers.getBodyFrameVideoOutputSize(ratio, quality);
    const totalFrames = videoHelpers.getBodyFrameVideoTotalFrames(7, 0.2);
    const record = vm.runInNewContext(compile(`(${recordCallback})`), {
      recordingViewAvailable: true,
      FileSystem: {
        cacheDirectory: "file:///cache/", getInfoAsync: async () => ({ exists: true, size: 50 }),
        makeDirectoryAsync: async () => {}, deleteAsync: async () => {}
      },
      projectPhotos: Array.from({ length: 7 }), totalFrames, outputSize,
      prepareBodyFrameVideoPhotos: async () => [{ id: "A", uri: "file:///staged.jpg" }],
      createBodyFrameImageReadiness: () => ({ wait: async () => {} }),
      imageReadiness: { current: null }, setRecordingPhotos: () => {}, setRecordingRunId: () => {},
      withBodyFrameExportTimeout: async promise => promise,
      runBodyFrameNativeRecording: async start => start(),
      assertBodyFrameExportActive: () => {},
      setRecordingFrameIndex: () => {}, waitForPaint: async () => {},
      recorder: { record: async options => { nativeOptions = options; return "/cache/result.mp4"; } },
      BODY_FRAME_VIDEO_FPS: 30, BODY_FRAME_VIDEO_BITRATE: 5_000_000,
      toNativeFilePath: uri => uri.replace("file://", ""), toFileUri: path => `file://${path}`,
      setExportProgress: () => {}
    });
    assert.equal((await record(new AbortController().signal)).uri, "file:///cache/result.mp4");
    assert.equal(nativeOptions.width, outputSize.width);
    assert.equal(nativeOptions.height, outputSize.height);
    assert.equal(nativeOptions.totalFrames, 42);
    assert.equal(nativeOptions.fps, 30);
  }
}
assert.ok(source.includes('router.push("/video-library")'), "provide an accessible video management route");
console.log("ok - real export handler blocks all native and external work at capacity");
