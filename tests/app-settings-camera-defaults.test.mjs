import assert from "node:assert/strict";
import fs from "node:fs";

import { readCameraSource } from "./camera-test-source.mjs";
import { readSettingsSource } from "./settings-test-source.mjs";

const source = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = readCameraSource();
const settingsSource = readSettingsSource();
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");

for (const snippet of [
  'cameraRatio: "9:16"',
  'cameraSaveScope: "app_device"',
  'const cameraRatios: PhotoRatioLabel[] = ["1:1", "3:4", "4:3", "4:5", "9:16", "16:9"]',
  "cameraRatios.includes(nextSettings.cameraRatio)",
  "normalizeCameraSaveScope(nextSettings.cameraSaveScope)",
  ": defaultAppSettings.cameraRatio",
  ": defaultAppSettings.cameraSaveScope",
  "return defaultAppSettings;"
]) {
  assert.ok(source.includes(snippet), `app settings camera defaults missing: ${snippet}`);
}

for (const snippet of [
  "useState<PhotoRatioLabel>(defaultAppSettings.cameraRatio)",
  "useState<CameraSaveScope>(defaultAppSettings.cameraSaveScope)",
  "setCameraRatio(settings.cameraRatio)",
  "setCameraSaveScope(settings.cameraSaveScope)",
  "ratioLabel: cameraRatio",
  "getCameraSaveScopeTargets(saveScope)",
  "targets.app || targets.cloud",
  "targets.device",
  "targets.cloud"
]) {
  assert.ok(cameraSource.includes(snippet), `camera should use normalized setting: ${snippet}`);
}

for (const snippet of [
  "useState<AppSettings>(defaultAppSettings)",
  "mark={settings.cameraRatio}",
  "mark={getCameraSaveScopeLabel(settings.cameraSaveScope)}",
  "active={settings.cameraRatio === ratio}",
  "active={getCameraSaveScopeTargets(settings.cameraSaveScope)[scope.value] && !isCloudSaveTargetDisabled}"
]) {
  assert.ok(settingsSource.includes(snippet), `settings screen should display normalized setting: ${snippet}`);
}

for (const snippet of [
  'if (label === "Original")',
  "return width && height ? width / height : undefined;",
  'const shouldApplyRatio = ratioLabel !== "Original"',
  "getRatioLabel(prepared.width, prepared.height)"
]) {
  assert.ok(photoLibrarySource.includes(snippet), `Original ratio should preserve captured dimensions: ${snippet}`);
}

assert.ok(
  !source.includes('const cameraRatios: PhotoRatioLabel[] = ["Original",'),
  "camera ratio setting should not allow Original as a saved camera default"
);
const cameraRatioOptionsSource = cameraSource.slice(
  cameraSource.indexOf("const CAMERA_RATIO_OPTIONS"),
  cameraSource.indexOf("const CAMERA_SAVE_SCOPE_OPTIONS")
);
assert.ok(
  !cameraRatioOptionsSource.includes('value: "Original"'),
  "camera ratio controls should not show the Original option"
);
assert.ok(
  !settingsSource.includes('const cameraRatioOptions = ["Original",'),
  "settings camera ratio controls should not show the Original option"
);

const cameraSaveScopeOptionsSource = cameraSource.slice(
  cameraSource.indexOf("const CAMERA_SAVE_SCOPE_OPTIONS"),
  cameraSource.indexOf("const CAMERA_FACING_OPTIONS")
);
assert.ok(
  cameraSaveScopeOptionsSource.includes('value: "app"') &&
    cameraSaveScopeOptionsSource.includes('value: "device"') &&
    cameraSaveScopeOptionsSource.includes('value: "cloud"'),
  "camera save scope controls should show app, phone album, and cloud toggles"
);

const settingsCameraSaveScopeOptionsSource = settingsSource.slice(
  settingsSource.indexOf("const cameraSaveScopeOptions"),
  settingsSource.indexOf("const tripClipExportFormatOptions")
);
assert.ok(
  settingsCameraSaveScopeOptionsSource.includes('value: "app"') &&
    settingsCameraSaveScopeOptionsSource.includes('value: "device"') &&
    settingsCameraSaveScopeOptionsSource.includes('value: "cloud"'),
  "settings camera save scope controls should show app, phone album, and cloud toggles"
);

console.log("ok - camera defaults use 9:16 and app plus phone album while preserving valid settings");
