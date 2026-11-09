import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

assert.ok(fs.existsSync("lib/camera-zoom-session.ts"), "zoom needs a lifecycle-owned driver instead of the unhandled Camera zoom prop");
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/camera-zoom-session.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText, { exports });
const { createCameraZoomSession } = exports;
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const canceled = () => new Error("androidx.camera.core.CameraControl$OperationCanceledException: Camera is not active");
const makeNativeController = () => {
  const calls = [];
  return {
    calls,
    setZoom(zoom) {
      return new Promise((resolve, reject) => calls.push({ zoom, resolve, reject }));
    }
  };
};

// The native controller is the external boundary; the actual driver owns request/session generations.
const errors = [];
const driver = createCameraZoomSession(error => errors.push(error));
const back = makeNativeController();
driver.setZoom(1.5);
driver.setZoom(2);
assert.equal(back.calls.length, 0, "initialization must not send zoom to an inactive camera");
driver.start(back);
assert.deepEqual(back.calls.map(call => call.zoom), [2], "onStarted restores the latest desired zoom");
driver.setZoom(2);
assert.equal(back.calls.length, 1, "the same zoom is not sent twice in a running session");
driver.setZoom(3);
back.calls[0].reject(canceled());
back.calls[1].resolve();
await flush();
assert.deepEqual(errors, [], "a newer zoom may cancel the previous request");

driver.setZoom(4);
driver.stop();
back.calls[2].reject(canceled());
driver.setZoom(5);
await flush();
assert.equal(back.calls.length, 3, "zoom changes during a tab switch/background wait for onStarted");
assert.deepEqual(errors, [], "stopped session cancellations are handled");
driver.start(back);
assert.deepEqual(back.calls.map(call => call.zoom), [2, 3, 4, 5], "resume restores zoom even with the same controller");

const front = makeNativeController();
driver.start(front);
back.calls[3].reject(canceled());
await flush();
assert.deepEqual(front.calls.map(call => call.zoom), [5], "a replacement lens receives the desired zoom");
assert.deepEqual(errors, [], "old-lens cancellation cannot fail the new session");

front.calls[0].reject(canceled());
await flush();
assert.equal(errors.length, 1, "an unexplained current-session cancellation remains visible");
const currentFailure = new Error("native zoom out of range");
driver.setZoom(6);
front.calls[1].reject(currentFailure);
await flush();
assert.equal(errors.at(-1), currentFailure, "real current-session errors reach the caller");
driver.setZoom(7);
driver.stop();
const oldFailure = new Error("camera service unavailable");
front.calls[2].reject(oldFailure);
await flush();
assert.equal(errors.at(-1), oldFailure, "stale sessions do not hide errors other than operation cancellation");

const syncFailure = new Error("native controller disposed");
driver.start({ setZoom() { throw syncFailure; } });
assert.equal(errors.at(-1), syncFailure, "synchronous native exceptions are handled too");
driver.stop();
driver.start(back);
const lookalikeFailure = new Error("Camera is not active");
driver.stop();
back.calls[4].reject(lookalikeFailure);
await flush();
assert.equal(errors.at(-1), lookalikeFailure, "only typed operation cancellations are ignored");

// Execute the actual direction callback: a no-op selection must not stop a session that will not restart.
const screen = ts.createSourceFile("CameraScreen.tsx", fs.readFileSync("features/camera/CameraScreen.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let changeFacingCallback;
const findFacingCallback = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(screen) === "changeCameraFacing") {
    changeFacingCallback = node.initializer.arguments[0].getText(screen);
  }
  ts.forEachChild(node, findFacingCallback);
};
findFacingCallback(screen);
assert.ok(changeFacingCallback, "camera direction controls expose their actual callback");
const facingZooms = [];
const facingDriver = createCameraZoomSession(error => { throw error; });
facingDriver.setZoom(1);
facingDriver.start({ setZoom(zoom) { facingZooms.push(zoom); return Promise.resolve(); } });
const facingExports = {};
vm.runInNewContext(ts.transpileModule(`exports.changeFacing = ${changeFacingCallback}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText, {
  exports: facingExports,
  cameraFacing: "back",
  stopCameraZoomSession: () => facingDriver.stop(),
  cameraFocusActionTokenRef: { current: 0 },
  cameraFocusLockedRef: { current: false },
  setCameraFacing() {}, setIsCameraReady() {}, setCameraFocusTap() {},
  setCameraFocusLocked() {}, setTorchEnabled() {}, queueAppSettingsUpdate() {}
});
facingExports.changeFacing("back");
facingDriver.setZoom(2);
assert.deepEqual(facingZooms, [1, 2], "reselecting the current direction keeps zoom controls active");
facingExports.changeFacing("front");
facingDriver.setZoom(3);
assert.deepEqual(facingZooms, [1, 2], "an actual direction change stops zoom until the replacement lens starts");

console.log("ok - camera zoom waits for start, restores across sessions, and handles only stale operation cancellations");
