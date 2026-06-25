import assert from "node:assert/strict";
import fs from "node:fs";

const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const stylesSource = fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8");

for (const snippet of [
  "export const CAMERA_COLOR_SLOT_COUNT = 5;",
  "export type CameraColorSlot = CameraColorValues | null;",
  "cameraColorSlots: CameraColorSlot[];",
  "selectedCameraColorSlot: number;",
  "cameraColorSlots: createEmptyCameraColorSlots(),",
  "selectedCameraColorSlot: 0,",
  "normalizeCameraColorSlots(nextSettings.cameraColorSlots)",
  "normalizeSelectedCameraColorSlot(nextSettings.selectedCameraColorSlot)"
]) {
  assert.ok(settingsSource.includes(snippet), `camera color slots setting missing: ${snippet}`);
}

for (const snippet of [
  "const [cameraColorSlots, setCameraColorSlots] = useState(defaultAppSettings.cameraColorSlots);",
  "useState(defaultAppSettings.selectedCameraColorSlot);",
  "setCameraColorSlots(settings.cameraColorSlots);",
  "setSelectedCameraColorSlot(settings.selectedCameraColorSlot);",
  "const applyCameraColorValues = useCallback(",
  "const applyCameraColorSlot = useCallback(",
  "if (!slot) {",
  "selectedCameraColorSlot: slotIndex",
  "const saveCameraColorSlot = useCallback(",
  "cameraColorSlots.map((slot, index) =>",
  "cameraColorSlots: nextSlots",
  "cameraColorSlots.map((slot, index) => (",
  "slot ? <View pointerEvents=\"none\" style={styles.cameraColorSlotSavedDot} /> : null",
  "accessibilityLabel={`",
  "${index + 1}`}",
  "styles.cameraColorCloseButton"
]) {
  assert.ok(cameraSource.includes(snippet), `camera color slot UI missing: ${snippet}`);
}

const resetSource = cameraSource.slice(
  cameraSource.indexOf("const resetCameraColorSettings = useCallback("),
  cameraSource.indexOf("const showFocusControls = useCallback(")
);
assert.ok(
  resetSource.includes("persistCameraColorValues(nextValues, selectedCameraColorSlot);"),
  "reset should persist the current color defaults"
);
assert.ok(!resetSource.includes("cameraColorSlots"), "reset should not clear or overwrite saved color slots");

const applySlotSource = cameraSource.slice(
  cameraSource.indexOf("const applyCameraColorSlot = useCallback("),
  cameraSource.indexOf("const saveCameraColorSlot = useCallback(")
);
for (const snippet of [
  "exposureBias: defaultAppSettings.cameraExposureBias",
  "temperature: defaultAppSettings.cameraColorTemperature",
  "tint: defaultAppSettings.cameraColorTint",
  "brightness: defaultAppSettings.cameraBrightness",
  "contrast: defaultAppSettings.cameraContrast",
  "saturation: defaultAppSettings.cameraSaturation",
  "persistCameraColorValues(nextValues, slotIndex);"
]) {
  assert.ok(applySlotSource.includes(snippet), `empty color slot should reset to defaults: ${snippet}`);
}

const saveSlotSource = cameraSource.slice(
  cameraSource.indexOf("const saveCameraColorSlot = useCallback("),
  cameraSource.indexOf("const saveCameraColorSettings = saveCameraColorSlot;")
);
for (const snippet of [
  "const isDefaultCameraColorValues =",
  "nextValues.exposureBias === defaultAppSettings.cameraExposureBias",
  "nextValues.temperature === defaultAppSettings.cameraColorTemperature",
  "nextValues.tint === defaultAppSettings.cameraColorTint",
  "nextValues.brightness === defaultAppSettings.cameraBrightness",
  "nextValues.contrast === defaultAppSettings.cameraContrast",
  "nextValues.saturation === defaultAppSettings.cameraSaturation",
  "const nextSlot = isDefaultCameraColorValues ? null : nextValues;",
  "index === selectedCameraColorSlot ? nextSlot : slot"
]) {
  assert.ok(saveSlotSource.includes(snippet), `default color values should clear saved slot marker: ${snippet}`);
}

for (const snippet of [
  "cameraColorHeaderRow",
  "cameraColorCloseButton",
  "cameraColorSlotRow",
  "cameraColorSlotButton",
  "cameraColorSlotButtonActive",
  "cameraColorSlotButtonSaved",
  "cameraColorSlotSavedDot",
  "cameraColorSlotText",
  "cameraColorSlotTextMuted"
]) {
  assert.ok(stylesSource.includes(snippet), `camera color slot styles missing: ${snippet}`);
}

console.log("ok - camera color modal exposes five persistent save slots");
