import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const packageJson = JSON.parse(read("package.json"));
const workflow = read(".github/workflows/android-play-aab.yml");
const nativeQA = read(".github/workflows/body-frame-device-qa.yml");
const patchEntry = read("scripts/apply-patches.mjs");
const recorderPatch = read("scripts/patch-view-recorder.mjs");
const capture = read("scripts/capture-android-qa.py");
const captureTest = read("scripts/test_capture_android_qa.py");

for (let stage = 1; stage <= 6; stage++) {
  const path = "docs/design/body-frame-stage" + stage + "-implementation-20261105.md";
  assert.ok(fs.existsSync(path), "previous stage design plan missing: " + path);
}
assert.equal(packageJson.scripts.postinstall, "node scripts/apply-patches.mjs");
assert.ok(patchEntry.includes("patchViewRecorderAndroidCallbacks"));
assert.ok(patchEntry.includes("patchViewRecorderAndroidStopRace()"));
for (const guard of [
  "ORIGINAL_SHA256",
  "PATCHED_SHA256",
  'version !== "0.4.1"',
  "codecStopped.set(true)",
  "if (codecStopped.get()) return",
  "if (e is MediaCodec.CodecException || !codecStopped.get()) throw e"
]) assert.ok(recorderPatch.includes(guard), "Android stop-race safety guard missing: " + guard);
assert.ok(fs.existsSync("tests/view-recorder-stop-race.test.mjs"));
assert.ok(fs.existsSync("tests/fixtures/view-recorder-callback-harness.kt"));
assert.ok(workflow.includes("BODY_FRAME_PLAY_SIGNING_APPROVED_20261107 == 'true'"), "Play signing release hold must remain active");
assert.ok(workflow.includes("inputs.operation == 'inventory'"), "Read-only Play inventory must remain possible");
assert.ok(nativeQA.includes("stage6-design-matrix:"));
assert.ok(nativeQA.includes("startsWith(github.head_ref, 'fix/body-frame-stage7-')"));
for(const marker of [
  "def wait_for_visual_profile(device, size, density, timeout_seconds=25):",
  "observed = struct.unpack('>II', screenshot[16:24])",
  "settled = wait_for_visual_profile(device, size, density)",
  "displaySettleEvidence",
  "args.scenario == 'visual'"
]) assert.ok(capture.includes(marker), "viewport readiness proof missing: " + marker);
assert.ok(captureTest.includes("test_visual_profile_awaits_actual_screenshot_dimensions"));
console.log("ok - Stage 7 native recorder, visual viewport and release gate integration controls");
