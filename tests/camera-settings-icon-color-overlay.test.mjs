import assert from "node:assert/strict";
import fs from "node:fs";

const camera = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const styles = fs.readFileSync(
  "features/camera/camera-screen.styles.ts",
  "utf8"
);

assert.ok(
  camera.includes('accessibilityLabel="촬영 설정 열기"') &&
    camera.includes('<Feather name="settings" size={20} color={colors.inverse} />'),
  "camera top-right action should use a settings icon"
);

for (const token of [
  'activeCameraControlPanel === "color"',
  "styles.cameraColorFloatingOverlay",
  "top: cameraPreviewTopOffset + 8",
  "cameraControlsHeight > 0",
  "cameraControlsHeight + 12",
  "styles.cameraColorFloatingScroll",
  "showsVerticalScrollIndicator={false}"
]) {
  assert.ok(camera.includes(token), `camera color overlay placement missing: ${token}`);
}

const deckStart = camera.indexOf(
  '<View collapsable={false} style={styles.cameraControlDeck}>'
);
const deckEnd = camera.indexOf(
  '<View\n                style={[styles.cameraControlBottomTray',
  deckStart
);
const deckSource = camera.slice(deckStart, deckEnd);

assert.equal(
  deckSource.includes('activeCameraControlPanel === "color"'),
  false,
  "color controls should not remain inside the bottom control deck"
);

for (const token of [
  "cameraColorFloatingOverlay:",
  'position: "absolute"',
  "zIndex: 60",
  "elevation: 60",
  "cameraColorFloatingCard:",
  "cameraColorFloatingScroll:"
]) {
  assert.ok(styles.includes(token), `camera color overlay style missing: ${token}`);
}

console.log("ok - camera settings icon and color overlay layering are stable");
