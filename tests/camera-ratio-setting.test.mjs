import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const previewSource = fs.readFileSync("app/capture-preview.tsx", "utf8");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
const photoTypesSource = fs.readFileSync("types/photo.ts", "utf8");

for (const snippet of [
  "cameraRatio: PhotoRatioLabel",
  'cameraRatio: "Original"',
  "const cameraRatios: PhotoRatioLabel[]",
  "cameraRatios.includes(nextSettings.cameraRatio)"
]) {
  assert.ok(settingsSource.includes(snippet), `app settings camera ratio missing: ${snippet}`);
}

for (const snippet of [
  "CAMERA_RATIO_OPTIONS",
  "cameraRatioAspect",
  'const [cameraRatio, setCameraRatio] = useState<PhotoRatioLabel>("Original")',
  "setCameraRatio(settings.cameraRatio)",
  "const updateCameraRatio = (nextRatio: PhotoRatioLabel)",
  "void updateAppSettings({ cameraRatio: nextRatio })",
  "카메라 비율",
  "ratioLabel: cameraRatio",
  "aspectRatio={cameraRatioAspect[cameraRatio] ?? 1}"
]) {
  assert.ok(cameraSource.includes(snippet), `camera ratio UI/wiring missing: ${snippet}`);
}

for (const snippet of [
  "cameraSettingsScrollShell",
  "cameraSettingsScrollHint",
  "스크롤",
  "showsVerticalScrollIndicator",
  "persistentScrollbar",
  "cameraSettingsBottomHint",
  "cameraSettingsGrabber",
  "cameraSettingsScrollHintIcon",
  "↓"
]) {
  assert.ok(cameraSource.includes(snippet), `camera settings scroll affordance missing: ${snippet}`);
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
  'ratioLabel = "Original"',
  'const shouldApplyRatio = ratioLabel !== "Original"',
  "renderEditedPhotoFromTransform({",
  "getRatioLabel(prepared.width, prepared.height)"
]) {
  assert.ok(photoLibrarySource.includes(snippet), `captured photo ratio save missing: ${snippet}`);
}

console.log("ok - camera ratio setting is applied to captured photos");
