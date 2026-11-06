import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Native video QA uses a stable emulator host with bounded media-tool prerequisites", () => {
  const workflow = fs.readFileSync(".github/workflows/body-frame-device-qa.yml", "utf8");
  const capture = workflow.split("  capture-devices:")[1]?.split("  stage13-design-captures:")[0];
  assert.ok(capture, "capture-devices job must remain registered");
  assert.ok(capture.includes("runs-on: ubuntu-24.04"));
  assert.ok(capture.includes("timeout-minutes: 45"));
  assert.match(capture, /name: Ensure native video inspection tools\s+timeout-minutes: 6/);
  assert.ok(capture.includes("timeout 120s sudo apt-get"));
  const mediaPackage = ["ff", "mpeg"].join("");
  assert.ok(capture.includes(`timeout 240s sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ${mediaPackage}`));
  assert.ok(capture.includes("ffprobe -version"));
  assert.ok(capture.includes("scripts/capture-android-qa.py"));
  assert.ok(capture.includes("body-frame-native-device-qa-"));
  assert.ok(!capture.includes("scripts/publish-play-release.mjs publish"));
  assert.ok(!capture.includes("bundleRelease"));
});

test("Android QA remains synthetic, with independent APK compilation and failed-run artifacts", () => {
  const workflow = fs.readFileSync(".github/workflows/body-frame-device-qa.yml", "utf8");
  assert.ok(workflow.includes("body-frame-native-qa-apk"));
  assert.ok(workflow.includes("Upload screenshots and capture diagnostics"));
  assert.ok(workflow.includes("if: always()"));
  assert.ok(workflow.includes("target: google_apis"));
  assert.ok(workflow.includes("x86_64"));
});
