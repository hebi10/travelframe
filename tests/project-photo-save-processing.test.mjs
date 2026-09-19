import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

// Exercise the real project, legacy and file-storage pipeline with native I/O doubles.
const setup = (failQuality, onEncode = async () => {}) => {
  const sourceUri = "file:///capture.jpg";
  const files = new Map([[sourceUri, { width: 3000, height: 4000, size: 8_000_000 }]]);
  const stored = new Map();
  const encodes = [];
  const finished = [];
  const colorAdjustments = [];
  let nextImage = 0;
  const cloneFile = (from, to) => {
    assert.ok(files.has(from), `missing source ${from}`);
    files.set(to, { ...files.get(from) });
  };
  const mocks = {
    "expo-file-system/legacy": {
      documentDirectory: "file:///documents/",
      makeDirectoryAsync: async () => {},
      getInfoAsync: async uri => ({ exists: files.has(uri), ...files.get(uri) }),
      copyAsync: async ({ from, to }) => cloneFile(from, to),
      moveAsync: async ({ from, to }) => { cloneFile(from, to); files.delete(from); },
      deleteAsync: async uri => { files.delete(uri); }
    },
    "expo-image-manipulator": {
      SaveFormat: { JPEG: "jpeg" },
      manipulateAsync: async (uri, actions, options) => {
        encodes.push(options.compress);
        await onEncode(options.compress);
        if (options.compress === failQuality) throw new Error("native optimization failed");
        const dimensions = { ...files.get(uri) };
        for (const action of actions) {
          if (action.crop) Object.assign(dimensions, { width: action.crop.width, height: action.crop.height });
          if (action.resize) Object.assign(dimensions, action.resize);
        }
        dimensions.size = Math.round(dimensions.width * dimensions.height * options.compress);
        const output = `file:///temporary-${++nextImage}.jpg`;
        files.set(output, dimensions);
        return { uri: output, width: dimensions.width, height: dimensions.height };
      }
    },
    "react-native": { Image: { getSize: (uri, callback) => callback(files.get(uri).width, files.get(uri).height) } },
    "@/lib/local-storage": { localStorageAdapter: {
      getItem: async key => stored.get(key) ?? null,
      setItem: async (key, value) => { stored.set(key, value); }
    } },
    "@/lib/app-settings": {
      getAppSettings: async () => ({ imageBackupQuality: "normal", exportQuality: "high" }),
      getExportQualityCompression: () => 0.92
    },
    "@/lib/android-image-adjustment": {
      hasCameraColorAdjustment: adjustment => Boolean(adjustment?.brightness),
      applyAndroidImageAdjustment: async ({ uri, adjustment }) => {
        colorAdjustments.push(adjustment);
        const output = `file:///adjusted-${++nextImage}.jpg`;
        cloneFile(uri, output);
        return { uri: output, ...files.get(output) };
      }
    },
    "@/lib/trip-clip-export": { saveImageToLibrary: async () => {} },
    "@/lib/body-project-library": { updateBodyProject: async () => {} },
    "@/lib/body-measurement-library": { detachBodyMeasurementsFromPhoto: async () => {} },
    "@/lib/body-frame-camera-session": {
      reserveBodyFrameCameraCapture: () => null,
      finishBodyFrameCameraCapture: value => finished.push(value)
    }
  };
  const cache = new Map();
  const load = relative => {
    if (cache.has(relative)) return cache.get(relative);
    const exports = {};
    cache.set(relative, exports);
    // Read bytes so the legacy source-assertion preload cannot concatenate modules.
    const code = ts.transpileModule(fs.readFileSync(relative).toString("utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      require: name => {
        if (mocks[name]) return mocks[name];
        if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`);
        throw new Error(`Unexpected module ${name}`);
      }
    });
    return exports;
  };
  return { library: load("lib/photo-library.ts"), sourceUri, encodes, files, finished, colorAdjustments };
};
const reservation = { projectId: "project-a", sequence: 1, reservationId: "capture-1" };
const input = { uri: "file:///capture.jpg", width: 3000, height: 4000, ratioLabel: "9:16", colorAdjustment: { brightness: 12 } };

const project = setup();
const photo = await project.library.saveCapturedPhoto(input, reservation);
assert.deepEqual(project.encodes, [1, 0.92, 0.85, 0.74], "project save must normalize/crop once and produce just one optimized image and preview");
assert.equal(Math.max(photo.width, photo.height), 2560, "legacy normal-quality preferences must not shrink a project original first");
assert.equal(Math.max(project.files.get(photo.previewUri).width, project.files.get(photo.previewUri).height), 1080);
assert.equal(photo.optimizedQuality, 0.85);
assert.equal(photo.projectId, "project-a");
assert.equal(photo.sequence, 1);
assert.equal(project.colorAdjustments.length, 1);
assert.equal((await project.library.getPhotos()).length, 1);
assert.equal(project.finished[0].success, true);

let continueOptimization;
let reachedOptimization;
const paused = new Promise(resolve => { reachedOptimization = resolve; });
const release = new Promise(resolve => { continueOptimization = resolve; });
const concurrentRead = setup(undefined, async quality => {
  if (quality === 0.85) {
    reachedOptimization();
    await release;
  }
});
const pendingSave = concurrentRead.library.saveCapturedPhoto(input, reservation);
await paused;
const draft = (await concurrentRead.library.getPhotos())[0];
assert.equal(draft.previewUri, draft.uri, "staging image should serve as its temporary preview");
await concurrentRead.library.ensurePhotoPreviews([draft]);
assert.deepEqual(concurrentRead.encodes, [1, 0.92, 0.85], "concurrent readers must not trigger an extra legacy preview or stale write");
continueOptimization();
const committed = await pendingSave;
assert.notEqual(committed.previewUri, committed.uri, "committed project photo must have its real optimized preview");

const legacy = setup();
await legacy.library.saveCapturedPhoto(input, null);
assert.deepEqual(legacy.encodes, [1, 0.92, 0.88, 0.78], "non-project legacy saves must keep their existing optimization and preview");

for (const failQuality of [0.85, 0.74]) {
  const failure = setup(failQuality);
  await assert.rejects(() => failure.library.saveCapturedPhoto(input, reservation));
  assert.ok(failure.files.has(failure.sourceUri), "failed project processing must preserve the captured source");
  assert.equal((await failure.library.getPhotos()).length, 0, "failed project processing must roll back the legacy draft");
  assert.equal(failure.finished.at(-1).success, false);
}
console.log("ok - project save skips duplicate optimization/preview without changing legacy saves or rollback");
