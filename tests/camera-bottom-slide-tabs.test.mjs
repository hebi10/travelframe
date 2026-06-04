import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = [
  fs.readFileSync("app/(tabs)/camera.tsx", "utf8"),
  fs.readFileSync("features/camera/camera-screen.constants.ts", "utf8"),
  fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8")
].join("\n");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");

for (const snippet of [
  "CAMERA_CONTROL_TABS",
  '"photo"',
  '"zoom"',
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
  "FadeIn",
  "entering={FadeIn.duration(140)}",
  "cameraControlTabTrackAnimatedStyle",
  "cameraControlTabViewport",
  "cameraControlTabTrack",
  "cameraControlTabCenterSpacer",
  "getCameraControlTabCenterPadding",
  "cameraControlTabCenterPadding",
  "cameraControlTabViewportWidth",
  "setCameraControlTabViewportWidth",
  "event.nativeEvent.layout.width",
  "CAMERA_CONTROL_HORIZONTAL_PADDING",
  "CAMERA_CONTROL_TRAY_HORIZONTAL_PADDING",
  "CAMERA_CONTROL_TAB_WIDTH",
  "CAMERA_CONTROL_TAB_GAP",
  "cameraControlShutterCenterX",
  "setCameraControlShutterCenterX",
  "x + width / 2",
  "selectCameraControlTab",
  "onPress={() => selectCameraControlTab(tab.id)}",
  "styles.cameraFloatingPanelWrap",
  "styles.cameraFloatingPanelRaised",
  "styles.cameraControlBottomTray",
  "gap: 30",
  "styles.cameraControlPage",
  "cameraZoomPresets",
  "1x",
  "3x",
  "5x",
  "10x",
  "setZoomPreset",
  "toggleCameraFacing",
  'name="refresh-cw"',
  "size={26}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera bottom slide tabs missing: ${snippet}`);
}

for (const removed of [
  "captureZoomControl",
  'label="줌"',
  'id: "guide"',
  'id: "light"',
  'activeCameraControlTab === "guide"',
  'activeCameraControlTab === "light"',
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
  cameraSource.includes("cameraControlTabSlideX"),
  "camera control tabs should still slide while the quick action buttons fade"
);

assert.ok(
  cameraSource.includes("setCameraControlTabViewportWidth(event.nativeEvent.layout.width)"),
  "camera control tab center padding should be derived from the actual rendered tab viewport width"
);

assert.ok(
  cameraSource.includes("CAMERA_CONTROL_TAB_GAP +"),
  "camera control tab centering should account for the track gap before the first tab"
);

assert.ok(
  cameraSource.includes("targetCenterX - CAMERA_CONTROL_TAB_WIDTH / 2 - CAMERA_CONTROL_TAB_GAP"),
  "camera control tab center should be derived from the measured shutter center instead of a fixed pixel nudge"
);

assert.ok(
  !cameraSource.includes("CAMERA_CONTROL_TAB_CENTER_NUDGE_X"),
  "camera control tab centering should not rely on a fixed pixel nudge"
);

assert.ok(
  !cameraSource.includes("bottomSafePadding + 96"),
  "camera quick action buttons should not use a fixed absolute bottom offset that can overlap the tab row"
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
  "cameraZoomPercent: number;",
  "cameraTorchEnabled: boolean;",
  "cameraFacing: CameraFacing;",
  "cameraZoomPercent: 0",
  "cameraTorchEnabled: false",
  'cameraFacing: "back"'
]) {
  assert.ok(settingsSource.includes(snippet), `camera quick setting persistence missing: ${snippet}`);
}

console.log("ok - camera bottom controls use centered slide tabs with persisted quick settings");
