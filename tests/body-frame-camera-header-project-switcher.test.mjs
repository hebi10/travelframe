import assert from "node:assert/strict";
import fs from "node:fs";

const wrapper = fs.readFileSync(
  "features/camera/BodyFrameCameraScreen.tsx",
  "utf8"
);
const camera = fs.readFileSync(
  "features/camera/CameraScreen.tsx",
  "utf8"
);
const switcher = fs.readFileSync(
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "utf8"
);
const cameraStyles = fs.readFileSync(
  "features/camera/camera-screen.styles.ts",
  "utf8"
);

assert.ok(
  wrapper.includes("headerCenter={") &&
    wrapper.includes("<BodyFrameProjectSwitcher") &&
    wrapper.includes("compact"),
  "Body Frame project switcher should render in the center camera header slot"
);

assert.equal(
  wrapper.includes("styles.projectSwitcherWrap"),
  false,
  "full-width project switcher should no longer occupy a second camera header row"
);

assert.ok(
  wrapper.includes("styles.captureHintWrap"),
  "capture guidance should remain below the compact header"
);

assert.ok(
  camera.includes("headerCenter?: ReactNode") &&
    camera.includes("{headerCenter}") &&
    camera.includes("styles.cameraHeaderCenter"),
  "CameraScreen should expose and render a center header slot"
);

assert.ok(
  camera.indexOf('accessibilityLabel={user ? "마이페이지로 이동" : "로그인으로 이동"}') <
    camera.indexOf("{headerCenter}") &&
    camera.indexOf("{headerCenter}") <
    camera.indexOf('accessibilityLabel="촬영 도구 열기"'),
  "project selector must sit between account and camera settings actions"
);

for (const token of [
  "compact?: boolean",
  "headerButtonCompact",
  "headerTitleCompact",
  "headerStatusCompact"
]) {
  assert.ok(switcher.includes(token), `compact switcher missing: ${token}`);
}

assert.ok(
  cameraStyles.includes("cameraHeaderCenter") &&
    cameraStyles.includes("marginHorizontal: 10"),
  "center header slot should preserve spacing from both icon buttons"
);

console.log("ok - compact project selector occupies the center camera header slot");
