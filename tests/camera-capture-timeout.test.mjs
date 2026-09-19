import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const exports = {};
const timers = new Set();
const code = ts.transpileModule(fs.readFileSync("lib/camera-capture-timeout.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
vm.runInNewContext(code, { exports, setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn) });
const { waitForCameraCapture, CameraCaptureTimeoutError } = exports;
let cleaned = [];
assert.equal(await waitForCameraCapture(Promise.resolve("normal"), async value => cleaned.push(value)), "normal");
assert.equal(timers.size, 0);
let finish;
const hanging = waitForCameraCapture(new Promise(resolve => { finish = resolve; }), async value => cleaned.push(value));
for (const timer of timers) timer();
timers.clear();
await assert.rejects(hanging, CameraCaptureTimeoutError);
finish("late-file");
for (let i = 0; i < 5; i++) await Promise.resolve();
assert.deepEqual(cleaned, ["late-file"]);
await assert.rejects(waitForCameraCapture(Promise.reject(new Error("camera failed")), async () => {}), /camera failed/);
assert.equal(timers.size, 0);
console.log("ok - stalled native capture times out and late files are cleaned without saving");
