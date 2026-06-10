import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const previewSource = fs.readFileSync("app/capture-preview.tsx", "utf8");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
const photoTypesSource = fs.readFileSync("types/photo.ts", "utf8");
const guideOverlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");

for (const snippet of [
  "cameraRatio: PhotoRatioLabel",
  'cameraRatio: "9:16"',
  "const cameraRatios: PhotoRatioLabel[]",
  "cameraRatios.includes(nextSettings.cameraRatio)"
]) {
  assert.ok(settingsSource.includes(snippet), `app settings camera ratio missing: ${snippet}`);
}

for (const snippet of [
  "CAMERA_RATIO_OPTIONS",
  "cameraRatioAspect",
  "const [cameraRatio, setCameraRatio] = useState<PhotoRatioLabel>(defaultAppSettings.cameraRatio)",
  "setCameraRatio(settings.cameraRatio)",
  "const selectedCameraRatioAspect = cameraRatioAspect[cameraRatio] ?? undefined",
  "const cameraPreviewViewportStyle = useMemo(",
  "const [cameraControlsHeight, setCameraControlsHeight] = useState(0)",
  "const [cameraTopBarHeight, setCameraTopBarHeight] = useState(0)",
  "const cameraPreviewTopOffset =",
  "const cameraPreviewBottomReserved = overlaySetupActive",
  "const cameraPreviewBottomOffset =",
  "cameraControlsHeight + CAMERA_PREVIEW_CONTROL_GAP",
  "bottom: 0",
  "const cameraPreviewFrameStyle = useMemo(",
  "const frameHeight = Math.round(width / selectedCameraRatioAspect);",
  "const boundedFrameHeight = Math.min(frameHeight, height);",
  "const availablePreviewHeight = Math.max(0, height - cameraPreviewTopOffset - cameraPreviewBottomOffset);",
  "const frameFitsAboveControls = boundedFrameHeight <= availablePreviewHeight;",
  "const preferredFrameTop = frameFitsAboveControls",
  "const latestFrameTop = height - boundedFrameHeight;",
  "Math.min(latestFrameTop,",
  "cameraPreviewTopOffset + Math.round((availablePreviewHeight - boundedFrameHeight) / 2)",
  "Math.round((height - boundedFrameHeight) / 2)",
  "width: \"100%\"",
  "top: frameTop",
  "setCameraPreviewViewport({ width, height });",
  "styles.cameraPreviewViewport",
  "styles.cameraPreviewFrame",
  "styles.cameraPreviewFrameFill",
  "const updateCameraRatio = (nextRatio: PhotoRatioLabel)",
  "queueAppSettingsUpdate({ cameraRatio: nextRatio })",
  "카메라 비율",
  "ratioLabel: cameraRatio",
  "aspectRatio={cameraRatioAspect[cameraRatio] ?? undefined}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera ratio UI/wiring missing: ${snippet}`);
}

for (const snippet of [
  '{ label: "4:3", value: "4:3" }',
  '"4:3": 4 / 3'
]) {
  assert.ok(cameraSource.includes(snippet), `camera ratio should expose 4:3: ${snippet}`);
}

assert.ok(
  settingsSource.includes('const cameraRatios: PhotoRatioLabel[] = ["1:1", "3:4", "4:3", "4:5", "9:16", "16:9"]'),
  "app settings should accept 4:3 as a camera ratio"
);

assert.ok(
  photoTypesSource.includes('"4:3"'),
  "photo ratio type should include 4:3"
);

const cameraPreviewSection = cameraSource.slice(
  cameraSource.indexOf("style={[styles.cameraPreviewViewport, cameraPreviewViewportStyle]}"),
  cameraSource.indexOf("{countdown ? (")
);
assert.ok(
  cameraPreviewSection.includes("<Camera") &&
    cameraPreviewSection.includes("<CameraGuideOverlay") &&
    cameraPreviewSection.includes("style={[styles.cameraPreviewFrame, cameraPreviewFrameStyle]}"),
  "camera preview and guide overlay should share the selected ratio frame"
);
assert.ok(
  cameraPreviewSection.includes("onLayout={(event) => {") &&
    cameraPreviewSection.includes("setCameraPreviewViewport({ width, height });"),
  "camera preview should measure the screen before placing the full-width ratio frame"
);
assert.ok(
  !cameraSource.includes("Math.round(height * selectedCameraRatioAspect)") &&
    !cameraSource.includes("viewportAspect > selectedCameraRatioAspect"),
  "camera preview should keep the selected-ratio frame full width instead of shrinking width to fit height"
);
assert.ok(
  cameraSource.includes("height: boundedFrameHeight") &&
    !cameraSource.includes("height: frameHeight,"),
  "camera preview should not create a frame taller than the visible phone screen"
);
assert.ok(
  !cameraSource.includes("latestTopWithoutBottomOverlap") &&
    !cameraSource.includes("Math.min(cameraPreviewTopReserved") &&
    !cameraSource.includes("Math.max(cameraPreviewTopOffset, preferredFrameTop)"),
  "camera preview should center in the non-capture area instead of pinning near the top"
);

const cameraRatioOptionsSource = cameraSource.slice(
  cameraSource.indexOf("const CAMERA_RATIO_OPTIONS"),
  cameraSource.indexOf("const CAMERA_SAVE_SCOPE_OPTIONS")
);

for (const forbidden of [
  'value: "Original"',
  'const cameraRatioOptions = ["Original",',
  'const cameraRatios: PhotoRatioLabel[] = ["Original",'
]) {
  const sourceToCheck = forbidden === 'value: "Original"'
    ? cameraRatioOptionsSource
    : `${cameraSource}\n${settingsSource}`;
  assert.ok(
    !sourceToCheck.includes(forbidden),
    `camera ratio should not expose Original as a camera setting: ${forbidden}`
  );
}

for (const snippet of [
  "aspectRatio,",
  "const constrainedFrameStyle",
  "aspectRatio: safeAspectRatio",
  "styles.overlayViewport",
  "styles.constrainedFrame"
]) {
  assert.ok(guideOverlaySource.includes(snippet), `guide overlay aspect-ratio frame missing: ${snippet}`);
}

for (const snippet of [
  "cameraSettingsScrollShell",
  "cameraSettingsScrollHint",
  "스크롤",
  "showsVerticalScrollIndicator",
  "persistentScrollbar",
  "cameraSettingsScrollHintIcon",
  "↓"
]) {
  assert.ok(cameraSource.includes(snippet), `camera settings scroll affordance missing: ${snippet}`);
}

for (const forbidden of [
  "cameraSettingsBottomHint",
  "cameraSettingsGrabber"
]) {
  assert.ok(
    !cameraSource.includes(forbidden),
    `camera settings should not keep the bottom white affordance: ${forbidden}`
  );
}

for (const forbidden of ["아래로 스크롤"]) {
  assert.ok(
    !cameraSource.includes(forbidden),
    `camera settings scroll label should only say scroll: ${forbidden}`
  );
}

for (const forbidden of [
  "cameraRatioMask",
  "styles.cameraRatioMask"
]) {
  assert.ok(
    !cameraSource.includes(forbidden),
    `camera ratio should not draw capture-blocking masks: ${forbidden}`
  );
}

for (const snippet of [
  "ratio?: string;",
  "const selectedRatio: PhotoRatioLabel",
  "previewRatioAspect",
  '"4:3": 4 / 3',
  'value === "4:3"',
  "ratioLabel: selectedRatio",
  'resizeMode={selectedRatioAspect ? "cover" : "contain"}'
]) {
  assert.ok(previewSource.includes(snippet), `capture preview ratio handling missing: ${snippet}`);
}

assert.ok(
  photoTypesSource.includes("ratioLabel?: PhotoRatioLabel;"),
  "captured photo input should accept a camera ratio"
);

for (const snippet of [
  '{ label: "4:3", value: 4 / 3 }',
  "resolveImageDimensions",
  "const capturedDimensions = await resolveImageDimensions({ uri, width, height });",
  'ratioLabel = "Original"',
  'const shouldApplyRatio = ratioLabel !== "Original"',
  "width: capturedDimensions?.width ?? width",
  "height: capturedDimensions?.height ?? height",
  "renderEditedPhotoFromTransform({",
  "getRatioLabel(prepared.width, prepared.height)"
]) {
  assert.ok(photoLibrarySource.includes(snippet), `captured photo ratio save missing: ${snippet}`);
}

console.log("ok - camera ratio setting is applied to captured photos");
