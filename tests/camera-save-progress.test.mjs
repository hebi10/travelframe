import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const start = source.indexOf("  const queueCapturedPhotoSave = useCallback(");
const end = source.indexOf("  const capturePhoto = async", start);
const code = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function harness({ localFailure = false, deviceOnly = false, albumFailure = false } = {}) {
  const album = deferred();
  const backup = deferred();
  const events = [];
  let pending = 0;
  let stage = null;
  let recent = null;
  const tail = { current: Promise.resolve() };
  const deps = {
    __DEV__: false,
    useCallback: (fn) => fn,
    setPendingPhotoSaveCount: (fn) => { pending = fn(pending); },
    setPhotoSaveStage: (value) => { stage = value; },
    getCameraSaveScopeTargets: () => ({ app: !deviceOnly, device: true, cloud: !deviceOnly }),
    saveCapturedPhoto: async () => {
      if (localFailure) throw new Error("local failure");
      return { id: "photo", uri: "file://stored.jpg" };
    },
    saveCapturedPhotoToDevice: async () => {
      await album.promise;
      if (albumFailure) throw new Error("album failure");
    },
    setRecentPhoto: (photo) => { recent = photo; },
    getBodyCaptureContextState: async () => ({ enabled: false }),
    saveBodyCaptureContext: async () => {},
    backupPhotoIfEnabled: async () => { await backup.promise; },
    recordBackupFailure: async () => {},
    getUserFacingErrorMessage: (error) => error.message,
    isDeviceAlbumPermissionError: () => false,
    showDeviceAlbumPermissionPrompt: () => events.push("permission-error"),
    setErrorMessage: (message) => events.push(message),
    finishBodyFrameCameraCapture: () => events.push("release"),
    deleteLocalFile: async () => events.push("cleanup"),
    captureSaveQueueTailRef: tail
  };
  const queue = new Function(...Object.keys(deps), `${code}; return queueCapturedPhotoSave;`)(...Object.values(deps));
  const enqueue = () => queue({ captureInput: { uri: "file://raw.jpg" }, captureReservation: { reservationId: "r" } });
  return { album, backup, events, tail, enqueue, state: () => ({ pending, stage, recent }) };
}

const normal = harness();
normal.enqueue();
await flush();
assert.equal(normal.state().recent?.id, "photo", "local photo must be visible before a slow album save completes");
assert.equal(normal.state().stage, "device");
assert.equal(normal.state().pending, 1, "do not claim all targets completed while album is pending");
normal.album.resolve();
await flush();
assert.equal(normal.state().stage, "cloud");
normal.backup.resolve();
await normal.tail.current;
assert.equal(normal.state().pending, 0);
assert.equal(normal.state().stage, null);

const failed = harness({ localFailure: true });
failed.enqueue();
await failed.tail.current;
await flush();
assert.equal(failed.state().pending, 0);
assert.equal(failed.state().stage, null);
assert.ok(failed.events.includes("local failure"));

const onlyDevice = harness({ deviceOnly: true, albumFailure: true });
onlyDevice.enqueue();
await flush();
assert.equal(onlyDevice.state().stage, "device");
assert.equal(onlyDevice.state().recent, null);
onlyDevice.album.resolve();
await onlyDevice.tail.current;
await flush();
assert.equal(onlyDevice.state().pending, 0);
assert.ok(onlyDevice.events.includes("album failure"));

const partial = harness({ albumFailure: true });
partial.enqueue();
partial.enqueue();
await flush();
assert.equal(partial.state().pending, 2, "queued captures must remain counted");
partial.album.resolve();
partial.backup.resolve();
await partial.tail.current;
await flush();
assert.equal(partial.state().pending, 0);
assert.equal(partial.state().recent?.id, "photo", "album failure must preserve the saved app photo");
assert.equal(partial.events.filter((event) => event === "album failure").length, 2);
console.log("ok - camera save progress reflects durable local, device and cloud completion");
