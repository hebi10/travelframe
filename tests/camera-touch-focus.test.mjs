import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const focusControlsPath = "lib/camera-focus-controls.ts";
assert.ok(fs.existsSync(focusControlsPath), "camera focus control helpers should exist");

const focusControlsSource = fs.readFileSync(focusControlsPath, "utf8");
const cameraSource = [
  fs.readFileSync("app/(tabs)/camera.tsx", "utf8"),
  fs.readFileSync("features/camera/camera-screen.components.tsx", "utf8"),
  fs.readFileSync("features/camera/camera-screen.constants.ts", "utf8"),
  fs.readFileSync("features/camera/camera-screen.helpers.ts", "utf8"),
  fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8")
].join("\n");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

const { outputText } = ts.transpileModule(focusControlsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
});
const focusControlsModule = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

assert.deepEqual(
  focusControlsModule.getNormalizedCameraFocusPoint(
    { x: 250, y: 100 },
    { width: 1000, height: 400 }
  ),
  { x: 0.25, y: 0.25 },
  "touch coordinates should be normalized to the camera frame"
);

assert.deepEqual(
  focusControlsModule.getNormalizedCameraFocusPoint(
    { x: -50, y: 900 },
    { width: 1000, height: 400 }
  ),
  { x: 0, y: 1 },
  "normalized focus points should clamp to the preview bounds"
);

assert.equal(
  focusControlsModule.getNormalizedCameraFocusPoint(
    { x: 100, y: 100 },
    { width: 0, height: 400 }
  ),
  null,
  "invalid camera frame sizes should skip native focus updates"
);

assert.deepEqual(
  focusControlsModule.getTapExposureControlPosition({
    tap: { x: 200, y: 220 },
    frame: { width: 400, height: 800 },
    controlWidth: 132,
    controlHeight: 34,
    offsetY: 34,
    margin: 16
  }),
  { left: 134, top: 254 },
  "exposure control should sit centered below the tap ring"
);

assert.deepEqual(
  focusControlsModule.getTapExposureControlPosition({
    tap: { x: 24, y: 780 },
    frame: { width: 400, height: 800 },
    controlWidth: 132,
    controlHeight: 34,
    offsetY: 34,
    margin: 16
  }),
  { left: 16, top: 750 },
  "exposure control should stay visible near screen edges"
);

for (const snippet of [
  'Camera,',
  "useCameraPermission",
  "useCameraDevice",
  "usePhotoOutput",
  "react-native-vision-camera",
  "type CameraRef",
  "type CameraPosition",
  "type MeteringMode",
  "photoOutput.capturePhotoToFile",
  "enableShutterSound: !cameraSilentCaptureEnabled",
  "cameraFocusTap",
  "cameraFocusLocked",
  "cameraExposureBias",
  "handleCameraTap",
  "focusTo(tap,",
  'CAMERA_FOCUS_METERING_MODES: MeteringMode[] = ["AF", "AE", "AWB"]',
  "getCameraFocusMeteringModes(cameraDevice)",
  'responsiveness: "snappy"',
  'adaptiveness: cameraFocusLockedRef.current ? "locked" : "continuous"',
  "autoResetAfter: cameraFocusLockedRef.current ? null : 5",
  "focusTo(cameraFocusTap,",
  'adaptiveness: "locked"',
  "resetFocus()",
  "exposure={cameraExposureBias}",
  "cameraDevice.supportsExposureBias",
  "cameraDevice.minExposureBias",
  "cameraDevice.maxExposureBias",
  "toggleCameraFocusLock",
  "focusIndicator",
  "CAMERA_FOCUS_INDICATOR_SIZE",
  "focusLockButton",
  "ExposureBiasControl",
  "getTapExposureControlPosition",
  "const EXPOSURE_CONTROL_WIDTH = 106",
  "EXPOSURE_TRACK_WIDTH",
  "styles.exposureTapControl",
  "Feather",
  'name="sun"',
  'name="user"',
  'user ? "마이페이지로 이동" : "로그인으로 이동"',
  'router.push("/account")',
  "scheduleFocusControlsDismiss",
  "cancelFocusControlsDismiss",
  "useAnimatedStyle",
  "withTiming",
  "focusControlsOpacity.value = 0",
  "focusIndicatorScale.value = 1.5",
  "300",
  "focusIndicatorAnimatedStyle",
  "focusControlsAnimatedStyle",
  'name={cameraFocusLocked ? "lock" : "unlock"}',
  'accessibilityLabel={cameraFocusLocked ? "초점 고정 해제" : "초점 고정"}',
  "onInteractionStart={cancelFocusControlsDismiss}",
  "onInteractionEnd={scheduleFocusControlsDismiss}",
  "cameraExposureBiasRef",
  "getExposureTrackXFromControlX",
  "getExposureBiasFromTrackX",
  "sliderTapGesture",
  "Gesture.Exclusive(sliderGesture, sliderTapGesture)",
  "dragStartThumbX.value = getExposureTrackXFromControlX(event.x, trackWidth)",
  "syncExposureThumbPosition",
  "getExposureThumbX",
  "useSharedValue(getExposureThumbX(value, min, max, EXPOSURE_TRACK_WIDTH))",
  "isExposureThumbReady",
  "styles.exposureThumbHidden",
  "cameraFocusTap && focusIndicatorVisible && exposureControlPosition",
  "event.x, event.y",
  "setTimeout(() => {",
  "2500"
]) {
  assert.ok(cameraSource.includes(snippet), `camera touch focus UI missing: ${snippet}`);
}

const handleCameraTapSource = cameraSource.slice(
  cameraSource.indexOf("const handleCameraTap"),
  cameraSource.indexOf("const toggleCameraFocusLock")
);

assert.equal(
  handleCameraTapSource.includes("setCameraExposureBias(0)"),
  false,
  "tapping a new focus point should keep the existing exposure value"
);

assert.equal(
  cameraSource.includes("exposureBottomControl"),
  false,
  "exposure control should not use a fixed bottom position"
);

assert.ok(
  packageJson.dependencies["react-native-vision-camera"],
  "VisionCamera dependency should be installed"
);
assert.ok(
  packageJson.dependencies["react-native-nitro-modules"],
  "VisionCamera v5 Nitro dependency should be installed"
);
assert.ok(
  packageJson.dependencies["react-native-nitro-image"],
  "VisionCamera v5 image dependency should be installed"
);
assert.equal(
  packageJson.dependencies["expo-camera"],
  undefined,
  "camera tab should no longer depend on expo-camera"
);

for (const snippet of [
  "CameraView",
  "expo-camera",
  "focusPoint={cameraFocusPoint}",
  "focusLocked={cameraFocusLocked}",
  "exposureBias={cameraExposureBias}",
  "focusAtPointAsync",
  "setFocusLockedAsync",
  "setExposureBiasAsync",
  "selectedLens={selectedCameraLens}",
  "getAvailableLensesAsync",
  "onAvailableLensesChanged"
]) {
  assert.equal(cameraSource.includes(snippet), false, `expo-camera path should be removed: ${snippet}`);
}

console.log("ok - VisionCamera tap focus and exposure control are wired");
