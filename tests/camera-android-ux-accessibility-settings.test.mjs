import assert from "node:assert/strict";
import fs from "node:fs";

import { readCameraSource } from "./camera-test-source.mjs";

const cameraSource = readCameraSource();
const componentsSource = fs.readFileSync("features/camera/camera-screen.components.tsx", "utf8");

for (const snippet of [
  "const CAMERA_PREVIEW_TOP_RESERVED = 88;",
  "const [cameraTopBarHeight, setCameraTopBarHeight] = useState(0)",
  "const cameraPreviewTopOffset =",
  "cameraTopBarHeight > 0",
  "cameraTopBarHeight + CAMERA_PREVIEW_CONTROL_GAP",
  "Math.max(insets.top + 56, CAMERA_PREVIEW_TOP_RESERVED)",
  "const availablePreviewHeight = Math.max(0, height - cameraPreviewTopOffset - cameraPreviewBottomOffset);",
  "const latestFrameTop = height - boundedFrameHeight;",
  "Math.min(latestFrameTop, preferredFrameTop)",
  "top: frameTop",
  "setCameraTopBarHeight((currentHeight) =>"
]) {
  assert.ok(cameraSource.includes(snippet), `camera preview should reserve top and bottom Android safe areas: ${snippet}`);
}

for (const snippet of [
  "export type CameraSettingsPatch = Partial<AppSettings>;",
  "const pendingSettingsPatchRef = useRef<CameraSettingsPatch | null>(null)",
  "const settingsSaveChainRef = useRef<Promise<void>>(Promise.resolve())",
  "const flushQueuedAppSettingsUpdates = useCallback(async () =>",
  "pendingSettingsPatchRef.current = {",
  "...pendingSettingsPatchRef.current",
  "...updates",
  "await updateAppSettings(nextPatch);",
  "const queueAppSettingsUpdate = useCallback(",
  "(updates: CameraSettingsPatch) =>",
  "settingsSaveChainRef.current = settingsSaveChainRef.current.then(",
  "queueAppSettingsUpdate({ cameraZoomPercent: nextZoom })",
  "queueAppSettingsUpdate({ cameraTorchEnabled: nextEnabled })",
  "queueAppSettingsUpdate({ cameraFacing: value, cameraTorchEnabled: false })",
  "queueAppSettingsUpdate({ cameraRatio: nextRatio })"
]) {
  assert.ok(cameraSource.includes(snippet), `camera setting writes should be serialized and merged: ${snippet}`);
}

for (const snippet of [
  "const cameraLightAvailable = cameraFacing === \"back\" && Boolean(cameraDevice);",
  "const visibleTorchEnabled = cameraLightAvailable && torchEnabled;",
  "const nextEnabled = cameraLightAvailable && enabled;",
  "cameraRef.current?.controller?.setTorchMode(enabled ? \"on\" : \"off\")",
  "disabled={!cameraLightAvailable}",
  "activeCameraControlPanel === \"light\" || visibleTorchEnabled",
  "valueLabel={visibleTorchEnabled ?"
]) {
  assert.ok(cameraSource.includes(snippet), `torch UI should respect rear camera torch support: ${snippet}`);
}

for (const snippet of [
  'accessibilityRole="button"',
  'accessibilityLabel="사진 촬영"',
  "accessibilityState={{",
  "disabled: !isCameraReady || isCapturing || !cameraDevice",
  "busy: isCapturing"
]) {
  assert.ok(cameraSource.includes(snippet), `shutter should expose TalkBack state: ${snippet}`);
}

for (const snippet of [
  "accessibilityState={{ selected: cameraFacing === option.value }}",
  "accessibilityState={{ selected: shutterTimer === option.value }}",
  "accessibilityState={{ selected: flashMode === option.value }}",
  "accessibilityState={{ selected: photoQuality === option.value }}",
  "accessibilityState={{ selected: cameraRatio === option.value }}",
  "accessibilityState={{ disabled: isCloudSaveTargetDisabled, selected: isSelected }}",
  "accessibilityState={{ selected: guide === type }}",
  "accessibilityState={{ selected: guideSize === option.value }}",
  "accessibilityState={{ selected: isActive }}",
  "accessibilityState={{ selected: guideColor === option.value }}",
  "accessibilityState={{ selected: guideVisible }}",
  "selected={visibleTorchEnabled}",
  "selected={guideVisible}",
  "selected={hapticEnabled}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera option buttons should expose selected state: ${snippet}`);
}

for (const snippet of [
  "selected?: boolean;",
  'accessibilityRole="switch"',
  "accessibilityState={{ disabled, checked: selected }}"
]) {
  assert.ok(componentsSource.includes(snippet), `setting toggle rows should expose switch state: ${snippet}`);
}

for (const snippet of [
  "accessibilityState={{ selected: mode === \"silent\" }}",
  "accessibilityState={{ selected: mode === \"sound\" }}"
]) {
  assert.ok(componentsSource.includes(snippet), `shutter sound choices should expose selected state: ${snippet}`);
}

console.log("ok - camera Android UX settings and accessibility are guarded");
