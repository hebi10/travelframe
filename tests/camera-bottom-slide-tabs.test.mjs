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
  "CAMERA_CONTROL_HORIZONTAL_PADDING",
  "CAMERA_CONTROL_TRAY_HORIZONTAL_PADDING",
  "CAMERA_CONTROL_RESET_BUTTON_WIDTH",
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
  "size={26}",
  "resetCameraQuickControls"
]) {
  assert.ok(cameraSource.includes(snippet), `camera bottom slide tabs missing: ${snippet}`);
}

for (const removed of [
  "captureZoomControl",
  'label="줌"',
  "cameraFlipText"
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
  cameraSource.includes("cameraFrame.width -"),
  "camera control tab center padding should be derived from the screen width instead of a fragile tab onLayout measurement"
);

assert.ok(
  !cameraSource.includes("setCameraControlTabViewportWidth"),
  "camera control tabs should not depend on viewport onLayout state for initial centering"
);

assert.ok(
  cameraSource.includes("bottomSafePadding + 176"),
  "camera quick action buttons should float above the bottom tray instead of living inside it"
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
