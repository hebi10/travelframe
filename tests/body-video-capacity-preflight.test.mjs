import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = fs.readFileSync("features/trip-clip/BodyFrameVideoScreen.tsx", "utf8");
const tree = ts.createSourceFile("screen.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "createVideo") {
    callback = node.initializer.arguments[0].getText(tree);
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

const runExport = async (storedCount) => {
  const events = [];
  const messages = [];
  const exporting = [];
  const context = {
    activeProject: { id: "a", name: "기록" },
    projectPhotos: [{ id: "photo", uri: "file:///photo.jpg" }],
    isExporting: false,
    planEntitlements: { canExportVideo: true, localVideoLimit: 30 },
    videoLimitState: { allowed: true },
    setIsExporting: (value) => exporting.push(value),
    setExportProgress: () => {},
    setMessage: (value) => messages.push(value),
    getMadeVideos: async () => Array.from({ length: storedCount }),
    assertLocalLibraryCapacity: limitExports.assertLocalLibraryCapacity,
    recordProjectVideo: async () => { events.push("record"); return "file:///video.mp4"; },
    saveVideoToLibrary: async () => { events.push("external-save"); },
    saveMadeVideo: async () => { events.push("app-save"); },
    getUserFacingErrorMessage: (error) => error.message,
    previewPhoto: { uri: "file:///photo.jpg" },
    BODY_FRAME_VIDEO_RATIO: "9:16",
    BODY_FRAME_VIDEO_TEMPLATE: "minimal",
    BODY_FRAME_VIDEO_TRANSITION: "none",
    BODY_FRAME_VIDEO_TRANSITION_DURATION: 0,
    durations: { photo: 0.1 },
    totalDuration: 0.1,
    formatDuration: (seconds) => `${seconds}초`
  };
  const handler = vm.runInNewContext(compile(`(${callback})`), context);
  await handler();
  return { events, messages, exporting };
};
const full = await runExport(30);
assert.deepEqual(full.events, [], "full storage must prevent native recording and every save");
assert.match(full.messages.at(-1), /영상 보관함 한도 30개/);
assert.deepEqual(full.exporting, [true, false], "failure must release the busy state");
const available = await runExport(29);
assert.deepEqual(available.events, ["record", "external-save", "app-save"]);
assert.match(available.messages.at(-1), /저장했습니다/);
assert.ok(source.includes('router.push("/legacy-studio")'), "provide an accessible video management route");
console.log("ok - real export handler blocks all native and external work at capacity");
