import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const load = async file => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  });
  return import("data:text/javascript," + encodeURIComponent(outputText));
};
const video = await load("lib/body-frame-video.ts");
const { prepareBodyFrameVideoPhotos, stageBodyFrameOriginalFile, getBodyFrameExportReserveBytes } = await load("lib/body-frame-video-export.ts");
const MiB = 1024 * 1024;
const photos = count => Array.from({ length: count }, (_, index) => ({
  id: "photo-" + index, uri: "file:///original-" + index, previewUri: "file:///preview-" + index
}));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
function fixture(items, bytes, hooks = {}) {
  const originals = new Map(items.map(photo => [photo.uri, 2 * MiB]));
  const copies = new Map();
  const deleted = [];
  let active = 0, peak = 0;
  const progress = [];
  const reserveBytes = getBodyFrameExportReserveBytes(video.getBodyFrameVideoTotalFrames(items.length), 30, 5_000_000);
  const stage = (uri, id, signal) => stageBodyFrameOriginalFile({
    uri, destination: "file:///staged-" + id, signal, reserveBytes,
    getInfo: async uri => {
      const size = originals.get(uri) ?? copies.get(uri);
      return size ? { exists: true, isDirectory: false, size } : { exists: false };
    },
    getFreeBytes: async () => bytes - [...copies.values()].reduce((a, b) => a + b, 0),
    copy: async (from, to) => {
      active++; peak = Math.max(active, peak);
      try {
        if (hooks.copy) await hooks.copy(from, to);
        copies.set(to, originals.get(from));
      } finally { active--; }
    },
    download: async () => { throw Error("no live remote access"); },
    discard: async uri => { deleted.push(uri); copies.delete(uri); }
  });
  return {
    originals, copies, deleted, progress, reserveBytes, stage,
    peak: () => peak,
    run: (signal, timeout) => prepareBodyFrameVideoPhotos(items, stage, signal, (count, total) => progress.push([count, total]), timeout)
  };
}
for (const count of [100, 200, 365]) {
  test(count + " originals stage sequentially and all intervals preserve frame identity", async () => {
    const input = photos(count), f = fixture(input, 2 * 1024 * MiB);
    const before = JSON.stringify(input);
    const staged = await f.run();
    assert.equal(staged.length, count);
    assert.equal(f.peak(), 1);
    assert.equal(f.copies.size, count);
    assert.equal(f.originals.size, count);
    assert.deepEqual(staged.map(photo => photo.id), input.map(photo => photo.id));
    assert.ok(staged.every(photo => photo.uri === photo.previewUri && photo.uri.startsWith("file:///staged-")));
    assert.equal(JSON.stringify(input), before);
    assert.equal(f.progress.length, count);
    assert.deepEqual(f.progress.at(-1), [count, count]);
    for (const interval of video.BODY_FRAME_VIDEO_INTERVALS) {
      const frames = video.getBodyFrameVideoTotalFrames(count, interval);
      assert.equal(video.getBodyFrameVideoPhotoIndex(frames - 1, interval), count - 1);
      for (let index = 0; index < count; index++) {
        assert.equal(video.getBodyFrameVideoPhotoIndex(index * Math.round(interval * 30), interval), index);
      }
    }
    assert.equal(video.getBodyFrameVideoOutputSize("9:16", 1080).height, 1920);
  });
}
test("insufficient free space stops further staging before copying and never tries a fallback", async () => {
  const input = photos(100);
  input[0].downloadURL = "https://example.test/original";
  const reserve = getBodyFrameExportReserveBytes(video.getBodyFrameVideoTotalFrames(100), 30, 5_000_000);
  const f = fixture(input, reserve + MiB);
  await assert.rejects(f.run(), { name: "BodyFrameExportSpaceError" });
  assert.equal(f.peak(), 0);
  assert.equal(f.originals.size, 100);
  assert.equal(f.copies.size, 0);
  assert.equal(f.deleted.length, 1);
  assert.equal(f.progress.length, 0);
});
for (const mode of ["cancel", "timeout"]) test("late native copy after " + mode + " discards only its staged file", async () => {
  const input = photos(200);
  const started = deferred(), resume = deferred(), copyDone = deferred();
  const f = fixture(input, 2 * 1024 * MiB, {
    copy: async () => { started.resolve(); await resume.promise; copyDone.resolve(); }
  });
  const controller = new AbortController();
  const run = f.run(controller.signal, mode === "timeout" ? 50 : 30_000);
  const failed = assert.rejects(run, mode === "timeout" ? { name: "BodyFrameExportTimeoutError" } : /취소/);
  await started.promise;
  if (mode === "cancel") controller.abort();
  await failed;
  resume.resolve();
  await copyDone.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.copies.size, 0);
  assert.equal(f.originals.size, 200);
  assert.deepEqual(f.deleted, ["file:///staged-photo-0"]);
  assert.equal(f.progress.length, 0);
});
