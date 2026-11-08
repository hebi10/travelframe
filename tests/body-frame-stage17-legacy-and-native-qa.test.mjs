import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(p, "utf8");
const css = read("features/trip-clip/trip-clip-screen.styles.ts");
const guide = read("features/trip-clip/components/TripClipGuideTab.tsx");
const music = read("features/trip-clip/components/TripClipMusicTab.tsx");
const workflow = read(".github/workflows/body-frame-device-qa.yml");

test("Legacy video control labels and minimum touch heights are preserved", () => {
  assert.match(css, /musicPickButton:\s*\{[^}]*minHeight:\s*bodyFrameDesign\.minTouchSize/);
  assert.match(css, /guideColorLabel:\s*\{[^}]*fontSize:\s*typography\.small/);
  assert.ok(guide.includes('accessibilityRole="radio"'));
  assert.ok(guide.includes("accessibilityState={{ selected: isActive }}"));
  assert.ok(music.includes('accessibilityRole="button"'));
  assert.ok(music.includes('accessibilityLabel={isPlaying ? "음악 미리듣기 정지" : "음악 미리듣기 재생"}'));
  assert.ok(music.includes("accessibilityState={{ disabled: !activeMusicSource }}"));
  assert.ok(music.includes("void playClip()"));
  assert.ok(music.includes("stopPlayback()"));
});

test("Native emulator QA prepares FFmpeg within bounded host limits and never publishes", () => {
  const native = workflow.split("  capture-devices:")[1]?.split("  stage13-design-captures:")[0];
  assert.ok(native, "native capture job must exist");
  assert.ok(native.includes("runs-on: ubuntu-24.04"));
  assert.ok(native.includes("timeout-minutes: 45"));
  assert.ok(native.includes("name: Ensure native video inspection tools\n        timeout-minutes: 6"));
  assert.ok(native.includes("timeout 120s sudo apt-get"));
  assert.ok(native.includes("timeout 240s sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ffmpeg"));
  assert.ok(native.includes("ffprobe -version"));
  assert.ok(native.includes("body-frame-native-device-qa-"));
  assert.ok(native.includes("scripts/capture-android-qa.py"));
  assert.ok(!native.includes("publish-play-release.mjs"));
});
