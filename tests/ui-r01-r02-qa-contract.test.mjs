import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const gesture = fs.readFileSync("scripts/verify_ui_r01_android_gestures.py", "utf8");
const camera = fs.readFileSync("scripts/verify_ui_r02_android_camera.py", "utf8");
const proof = fs.readFileSync("scripts/verify_ui_r01_r02_reports.py", "utf8");
const workflow = fs.readFileSync(".github/workflows/body-frame-device-qa.yml", "utf8");

test("UI-R01 uses true Android swipes and observed accessible divider values", () => {
  assert.match(gesture, /device\.shell\("input", "swipe"/);
  assert.match(gesture, /android\.widget\.SeekBar/);
  assert.match(gesture, /vertical-scroll-within-photo/);
  assert.match(gesture, /diagonal-vertical-preserves-slider/);
  assert.match(gesture, /horizontal-photo-drag-adjusts-divider/);
  assert.match(gesture, /horizontal-left-adjusts-divider/);
  assert.match(gesture, /preset-.*value/);
  assert.match(gesture, /original-records-unchanged/);
});

test("UI-R02 tests camera controls/permission but cannot claim real ARM64 hardware", () => {
  assert.match(camera, /stage13\.verified_capture/);
  assert.match(camera, /stage13\.capture_camera_permission_denied/);
  assert.match(camera, /PENDING_ARM64_REAL_DEVICE/);
  assert.match(camera, /realPhotoSavedTested": False/);
  assert.match(camera, /nativeCameraPreviewTested": False/);
  assert.match(camera, /camera-reference-adjust/);
});

test("R01/R02 workflow retains evidence and denies production application changes", () => {
  assert.match(proof, /prove_image/);
  assert.match(proof, /r01_sum\.get\("gitHead"\) != r02_sum\.get\("source"\)/);
  assert.match(proof, /camera\.get\("hardwareResult"\) == "PENDING_ARM64_REAL_DEVICE"/);
  assert.match(workflow, /ui-r01-r02-android/);
  assert.match(workflow, /ui-r01-r02-verify/);
  assert.match(workflow, /qa\/ui-r01-r02-/);
  assert.match(workflow, /Unexpected runtime changes/);
});
