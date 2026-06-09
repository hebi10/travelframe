import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = [
  fs.readFileSync("app/(tabs)/camera.tsx", "utf8"),
  fs.readFileSync("features/camera/camera-screen.constants.ts", "utf8"),
  fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8")
].join("\n");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");

for (const snippet of [
  "const openZoomControls = () =>",
  'activeCameraControlPanel === "zoom"',
  'setActiveCameraControlPanel((current) => (current === "zoom" ? null : "zoom"))',
  'accessibilityLabel="확대 설정 열기"',
  '<Text selectable={false} style={styles.cameraInstantControlText}>확대</Text>',
  "cameraZoomPresets",
  "1x",
  "3x",
  "5x",
  "10x",
  "setZoomPreset",
  "toggleCameraFacing",
  'name="refresh-cw"',
  "size={26}",
  "styles.cameraFloatingPanelWrap",
  "styles.cameraFloatingPanelRaised",
  "styles.cameraControlBottomTray",
  "styles.cameraControlPage",
  "FadeIn",
  "entering={FadeIn.duration(140)}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera top zoom control missing: ${snippet}`);
}

for (const removed of [
  "CAMERA_CONTROL_TABS",
  "CameraControlTab",
  "cameraControlTabGesture",
  "cameraControlTabPanGesture",
  "cameraControlTabTapGesture",
  "selectCameraControlTabByIndex",
  "getNearestCameraControlTabIndex",
  "getCameraControlTabOffset",
  "cameraControlTabTrackAnimatedStyle",
  "cameraControlTabViewport",
  "cameraControlTabTrack",
  "cameraControlTabCenterSpacer",
  "cameraControlTabRow",
  "cameraControlTabCenterPadding",
  "cameraControlTabViewportWidth",
  "setCameraControlTabViewportWidth",
  "cameraControlTabSlideX",
  "cameraControlTabStartX",
  "styles.cameraControlTab",
  "styles.cameraControlTabActive",
  "styles.cameraControlTabText",
  "styles.cameraControlTabTextActive",
  "<Text selectable={false} style={styles.cameraInstantControlText}>사진</Text>",
  "captureZoomControl",
  'label="줌"',
  'id: "guide"',
  'id: "light"',
  "cameraFlipText",
  "CAMERA_CONTROL_RESET_BUTTON_WIDTH",
  "CAMERA_CONTROL_ROW_GAP",
  "resetCameraQuickControls",
  "cameraControlResetButton",
  "rotate-ccw",
  "cameraControlSlideX",
  "cameraControlPagerAnimatedStyle",
  "setCameraControlPanelWidth",
  "styles.cameraControlPager",
  "FadeOut",
  "exiting={",
  "const CAMERA_ZOOM_PRESETS = [",
  "guideVisible && !referenceUri && styles.quickPillButtonActive",
  "guideVisible && !referenceUri && styles.quickPillTextActive",
  "referenceUri && styles.quickPillButtonActive"
]) {
  assert.ok(!cameraSource.includes(removed), `legacy bottom control should be removed: ${removed}`);
}

assert.ok(
  !cameraSource.includes("bottomSafePadding + 96"),
  "camera quick action buttons should not use a fixed absolute bottom offset"
);

assert.ok(
  cameraSource.includes("marginBottom: 10"),
  "camera quick action buttons should sit just above the bottom tray with a stable layout gap"
);

assert.ok(
  cameraSource.includes("const CAMERA_CONTROL_HORIZONTAL_PADDING = 0"),
  "bottom camera controls should fill the full screen width"
);

assert.ok(
  cameraSource.includes("paddingBottom: bottomSafePadding"),
  "bottom tray background should include the safe-area padding instead of leaving an empty strip"
);

for (const snippet of [
  "const [cameraControlsHeight, setCameraControlsHeight] = useState(0)",
  "cameraControlsHeight + CAMERA_PREVIEW_CONTROL_GAP",
  "setCameraControlsHeight((currentHeight) =>",
  "const availablePreviewHeight = Math.max(0, height - cameraPreviewTopOffset - cameraPreviewBottomOffset);",
  "const frameFitsAboveControls = boundedFrameHeight <= availablePreviewHeight;"
]) {
  assert.ok(cameraSource.includes(snippet), `camera preview should reserve measured controls height: ${snippet}`);
}

for (const snippet of [
  "cameraZoomPercent: number;",
  "cameraTorchEnabled: boolean;",
  "cameraFacing: CameraFacing;",
  "cameraZoomPercent: 0",
  "cameraTorchEnabled: false",
  'cameraFacing: "back"'
]) {
  assert.ok(settingsSource.includes(snippet), `camera quick setting persistence missing: ${snippet}`);
}

console.log("ok - camera bottom controls keep only capture actions while top controls open zoom");
