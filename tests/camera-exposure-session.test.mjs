import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

assert.ok(
  fs.existsSync("lib/camera-exposure-session.ts"),
  "exposure needs a lifecycle-owned driver to catch native promise rejections"
);
const driverExports = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync("lib/camera-exposure-session.ts", "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }
).outputText, { exports: driverExports });
const { createCameraExposureSession } = driverExports;
const flush = async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); };
const canceled = () => new Error(
  "androidx.camera.core.CameraControl$OperationCanceledException: Cancelled by another setExposureCompensationIndex()"
);
const makeNativeController = () => {
  const calls = [];
  return {
    calls,
    setExposureBias(value) {
      return new Promise((resolve, reject) => calls.push({ value, resolve, reject }));
    }
  };
};

const errors = [];
const session = createCameraExposureSession(error => errors.push(error));
const back = makeNativeController();

session.setExposureBias(-1);
session.setExposureBias(0.5);
assert.deepEqual(back.calls, [], "initialization must not send exposure before the session starts");
session.start(back);
assert.deepEqual(back.calls.map(call => call.value), [0.5], "start applies only the latest desired exposure");

session.start(back);
session.setExposureBias(0.5);
assert.equal(back.calls.length, 1, "same controller and exposure do not issue duplicate native calls");

session.setExposureBias(1);
back.calls[0].reject(canceled());
back.calls[1].resolve();
await flush();
assert.deepEqual(errors, [], "a newer exposure can cancel the previous native request");

session.setExposureBias(-0.25);
session.stop();
back.calls[2].reject(canceled());
session.setExposureBias(-0.5);
session.setExposureBias(-0.75);
await flush();
assert.equal(back.calls.length, 3, "inactive changes wait for the next started session");
assert.deepEqual(errors, [], "stopped session cancellation is handled");

session.start(back);
assert.deepEqual(back.calls.map(call => call.value), [0.5, 1, -0.25, -0.75], "returning to the same controller restores the latest value");
const front = makeNativeController();
session.start(front);
back.calls[3].reject(canceled());
await flush();
assert.deepEqual(front.calls.map(call => call.value), [-0.75], "a replacement camera restores the desired exposure");
assert.deepEqual(errors, [], "replaced camera cancellation cannot fail the current session");

const currentCancellation = canceled();
front.calls[0].reject(currentCancellation);
await flush();
assert.equal(errors.at(-1), currentCancellation, "an unexplained current-request cancellation remains visible");

session.setExposureBias(0);
const nativeFailure = new Error("Exposure bias is out of range");
front.calls[1].reject(nativeFailure);
await flush();
assert.equal(errors.at(-1), nativeFailure, "real current-request errors reach onError");

session.setExposureBias(0.25);
session.stop();
const staleFailure = new Error("Camera service unavailable");
front.calls[2].reject(staleFailure);
await flush();
assert.equal(errors.at(-1), staleFailure, "stale sessions do not conceal non-cancellation errors");

const syncFailure = new Error("Native controller disposed");
session.start({ setExposureBias() { throw syncFailure; } });
assert.equal(errors.at(-1), syncFailure, "synchronous native failures reach onError");

session.stop();
const lookalike = makeNativeController();
session.start(lookalike);
session.stop();
const lookalikeFailure = new Error("Cancelled by another setExposureCompensationIndex()");
lookalike.calls[0].reject(lookalikeFailure);
await flush();
assert.equal(errors.at(-1), lookalikeFailure, "cancellation-looking text without the native exception type stays visible");
assert.equal(errors.length, 5, "only expected native cancellations from superseded requests are suppressed");

const unset = makeNativeController();
const unsetSession = createCameraExposureSession(error => { throw error; });
unsetSession.start(unset);
assert.deepEqual(unset.calls, [], "starting before a desired exposure does not invent a default native update");
unsetSession.setExposureBias(0);
assert.deepEqual(unset.calls.map(call => call.value), [0], "zero exposure is a valid desired value");
unset.calls[0].resolve();
unsetSession.stop();
unsetSession.start(unset);
assert.deepEqual(unset.calls.map(call => call.value), [0, 0], "resume reapplies even an unchanged exposure to the restarted session");
unset.calls[1].resolve();
unsetSession.stop();
await flush();

console.log("ok - camera exposure waits for session start, restores across sessions and handles native promise failures");
