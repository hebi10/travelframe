import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");

for (const snippet of [
  "CAMERA_CONTROL_TABS",
  '"photo"',
  '"zoom"',
  '"guide"',
  '"light"',
  'useState<CameraControlTab>("photo")',
  "cameraControlTabGesture",
  "cameraControlTabPanGesture",
  "cameraControlTabTapGesture",
  "selectCameraControlTabByIndex",
  "getNearestCameraControlTabIndex",
  "getCameraControlTabOffset",
  "Gesture.Pan()",
  "Gesture.Tap()",
  "Gesture.Exclusive",
  "cameraControlTabSlideX",
  "cameraControlTabTrackAnimatedStyle",
  "cameraControlTabViewport",
  "cameraControlTabTrack",
  "cameraControlTabCenterSpacer",
  "cameraControlTabCenterPadding",
  "cameraControlTabViewportWidth",
  "setCameraControlTabViewportWidth",
  "event.nativeEvent.layout.width",
  "CAMERA_CONTROL_HORIZONTAL_PADDING",
  "CAMERA_CONTROL_TRAY_HORIZONTAL_PADDING",
  "CAMERA_CONTROL_TAB_WIDTH",
  "CAMERA_CONTROL_TAB_GAP",
  "selectCameraControlTab",
  "styles.cameraFloatingPanelWrap",
  "styles.cameraFloatingPanelRaised",
  "styles.cameraControlBottomTray",
  "gap: 30",
  "styles.cameraControlPager",
  "styles.cameraControlPage",
  "CAMERA_ZOOM_PRESETS",
  "1x",
  "3x",
  "5x",
  "8x",
  "10x",
  "setZoomPreset",
  "setLightEnabled",
  "toggleCameraFacing",
  'name="refresh-cw"',
  "size={26}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera bottom slide tabs missing: ${snippet}`);
}

for (const removed of [
  "captureZoomControl",
  'label="줌"',
  "cameraFlipText",
  "CAMERA_CONTROL_RESET_BUTTON_WIDTH",
  "CAMERA_CONTROL_ROW_GAP",
  "resetCameraQuickControls",
  "cameraControlResetButton",
  "rotate-ccw"
]) {
  assert.ok(!cameraSource.includes(removed), `legacy bottom control should be removed: ${removed}`);
}

assert.ok(
  !cameraSource.includes("lastOffset"),
  "camera control tabs should not clamp the first or last item away from the center slot"
);

assert.ok(
  !cameraSource.includes("activeCameraControlTabIndex + direction"),
  "camera control tab drag should not move only one item by direction"
);

assert.ok(
  cameraSource.includes("cameraControlTabStartX.value + event.translationX"),
  "camera control tab drag should choose the selected item from the full drag distance"
);

assert.ok(
  cameraSource.includes("setCameraControlTabViewportWidth(event.nativeEvent.layout.width)"),
  "camera control tab center padding should be derived from the actual rendered tab viewport width"
);

assert.ok(
  cameraSource.includes("bottomSafePadding + 96"),
  "camera quick action buttons should float close above the bottom tray without covering the camera preview"
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
  "cameraZoomPercent: number;",
  "cameraTorchEnabled: boolean;",
  "cameraFacing: CameraType;",
  "cameraZoomPercent: 0",
  "cameraTorchEnabled: false",
  'cameraFacing: "back"'
]) {
  assert.ok(settingsSource.includes(snippet), `camera quick setting persistence missing: ${snippet}`);
}

console.log("ok - camera bottom controls use centered slide tabs with persisted quick settings");
