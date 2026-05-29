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
  "const updateCameraRatio = (nextRatio: PhotoRatioLabel)",
  "void updateAppSettings({ cameraRatio: nextRatio })",
  "카메라 비율",
  "ratioLabel: cameraRatio",
  "aspectRatio={cameraRatioAspect[cameraRatio] ?? undefined}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera ratio UI/wiring missing: ${snippet}`);
}

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
  "selectedCameraRatioAspect",
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
