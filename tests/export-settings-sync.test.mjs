import assert from "node:assert/strict";
import fs from "node:fs";

const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");

for (const snippet of [
  "videoQuality: VideoQualityId",
  "tripClipExportFormat: TripClipExportFormat",
  "imageSaveFormat: AppImageSaveFormat",
  'videoQuality: DEFAULT_VIDEO_QUALITY',
  'tripClipExportFormat: "mp4"',
  'imageSaveFormat: "original"',
  "videoQualities.includes(nextSettings.videoQuality)",
  "tripClipExportFormats.includes(nextSettings.tripClipExportFormat)",
  "imageSaveFormats.includes(nextSettings.imageSaveFormat)"
]) {
  assert.ok(appSettingsSource.includes(snippet), `app settings export sync missing: ${snippet}`);
}

for (const snippet of [
  'label="카메라 비율"',
  'onPress={() => setActiveSetting("cameraRatio")}',
  'label="저장 범위"',
  'onPress={() => setActiveSetting("cameraSaveScope")}',
  'label="기본 저장 형식"',
  'mark={tripClipExportFormatLabel[settings.tripClipExportFormat]}',
  'onPress={() => setActiveSetting("tripClipExportFormat")}',
  'label="영상 화질"',
  'mark={videoQualityLabel[settings.videoQuality]}',
  'onPress={() => setActiveSetting("videoQuality")}',
  'label="이미지 형식"',
  'mark={imageSaveFormatLabel[settings.imageSaveFormat]}',
  'onPress={() => setActiveSetting("imageSaveFormat")}'
]) {
  assert.ok(settingsSource.includes(snippet), `settings export UI missing: ${snippet}`);
}

for (const snippet of [
  "cameraRatioOptions.map",
  "cameraSaveScopeOptions.map",
  "tripClipExportFormatOptions.map",
  "VIDEO_QUALITY_OPTIONS.map",
  "imageSaveFormatOptions.map"
]) {
  assert.ok(settingsSource.includes(snippet), `settings export modal missing: ${snippet}`);
}

for (const snippet of [
  "queueAppSettingsUpdate({ cameraRatio: nextRatio })",
  "queueAppSettingsUpdate({ cameraSaveScope: nextScope })"
]) {
  assert.ok(cameraSource.includes(snippet), `camera settings should persist: ${snippet}`);
}

for (const snippet of [
  "setVideoQuality(settings.videoQuality)",
  "setExportFormat(settings.tripClipExportFormat)",
  "setImageSaveFormat(settings.imageSaveFormat)",
  "updateTripClipRatio",
  "updateTripClipExportFormat",
  "updateTripClipVideoQuality",
  "updateTripClipImageSaveFormat",
  "void updateAppSettings({ defaultRatio: nextRatio })",
  "void updateAppSettings({ tripClipExportFormat: nextFormat })",
  "void updateAppSettings({ videoQuality: nextQuality })",
  "void updateAppSettings({ imageSaveFormat: nextFormat })"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip export sync missing: ${snippet}`);
}

console.log("ok - export settings stay synced across settings, camera, and trip clip");
