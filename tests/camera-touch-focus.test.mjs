import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const focusControlsPath = "lib/camera-focus-controls.ts";
assert.ok(fs.existsSync(focusControlsPath), "camera focus control helpers should exist");

const focusControlsSource = fs.readFileSync(focusControlsPath, "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const nativeCameraSource = fs.readFileSync(
  "node_modules/expo-camera/android/src/main/java/expo/modules/camera/ExpoCameraView.kt",
  "utf8"
);
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const patchPath = "patches/expo-camera+55.0.0.patch";

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
  "cameraFocusPoint",
  "cameraFocusLocked",
  "cameraExposureBias",
  "handleCameraTap",
  "focusPoint={cameraFocusPoint}",
  "focusLocked={cameraFocusLocked}",
  "exposureBias={cameraExposureBias}",
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
  'name="home"',
  'accessibilityLabel="홈으로 이동"',
  'router.push("/home")',
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

assert.equal(
  cameraSource.includes("setCameraExposureBias(0)"),
  false,
  "tapping a new focus point should keep the existing exposure value"
);

assert.equal(
  cameraSource.includes("exposureBottomControl"),
  false,
  "exposure control should not use a fixed bottom position"
);

assert.equal(packageJson.scripts.postinstall, "node scripts/apply-patches.mjs");
assert.ok(fs.existsSync("scripts/apply-patches.mjs"), "local patch apply script should exist");
assert.ok(fs.existsSync(patchPath), "expo-camera patch should be committed");

const patchSource = fs.readFileSync(patchPath, "utf8");
for (const snippet of [
  "focusPoint",
  "focusLocked",
  "exposureBias",
  "disableAutoCancel",
  "if (field == FocusMode.OFF && focusPoint == null)",
  "focusPoint?.let {",
  "startFocusMetering(it)",
  "?: startFocusMetering()",
  "previewView.meteringPointFactory.createPoint(pointX, pointY)",
  "FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE or FocusMeteringAction.FLAG_AWB",
  "setExposureCompensationIndex"
]) {
  assert.ok(patchSource.includes(snippet), `expo-camera Android patch missing: ${snippet}`);
}

assert.equal(
  nativeCameraSource.includes("DisplayOrientedMeteringPointFactory("),
  false,
  "expo-camera Android native code should let PreviewView map metering coordinates"
);

console.log("ok - camera touch focus and exposure control are wired");
