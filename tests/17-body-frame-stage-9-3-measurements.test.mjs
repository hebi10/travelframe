import assert from "node:assert/strict";
import fs from "node:fs";

const types = fs.readFileSync("types/body-measurement.ts", "utf8");
const normalization = fs.readFileSync("lib/body-measurement-normalization.ts", "utf8");
const library = fs.readFileSync("lib/body-measurement-library.ts", "utf8");
const photoLibrary = fs.readFileSync("lib/photo-library.ts", "utf8");
const photoTypes = fs.readFileSync("types/photo.ts", "utf8");
const projectDetail = fs.readFileSync("features/records/BodyFrameProjectDetailScreen.tsx", "utf8");
const photoDetail = fs.readFileSync("app/photo/[id].tsx", "utf8");
const camera = fs.readFileSync("features/camera/BodyFrameCameraScreen.tsx", "utf8");
const editor = fs.readFileSync("features/records/BodyMeasurementEditorSheet.tsx", "utf8");

for (const token of [
  "BodyMeasurementMetric", '"weight"', '"bodyFat"', '"skeletalMuscle"', '"waist"',
  "weightKg?: number", "bodyFatPercent?: number", "skeletalMuscleKg?: number",
  "waistCm?: number", 'source: "manual" | "health_connect"', "enabled: false",
  "promptAfterCapture: false"
]) assert.ok(types.includes(token), `measurement types should contain ${token}`);

for (const token of [
  "weightKg: { min: 20, max: 500 }", "bodyFatPercent: { min: 1, max: 70 }",
  "skeletalMuscleKg: { min: 5, max: 150 }", "waistCm: { min: 30, max: 300 }",
  "parseMeasurementInput", "normalizeBodyMeasurementSettings", "normalizeBodyMeasurementEntry"
]) assert.ok(normalization.includes(token), `measurement normalization should contain ${token}`);

for (const token of [
  "BODY_MEASUREMENT_STORAGE_KEY", '"measurements"', '"v1"',
  "BODY_MEASUREMENT_SETTINGS_STORAGE_KEY", '"measurement-settings"',
  "getBodyMeasurementSettings", "updateBodyMeasurementSettings",
  "getBodyMeasurements", "getBodyMeasurementByPhotoId", "saveBodyMeasurement",
  "deleteBodyMeasurement", "detachBodyMeasurementsFromPhoto"
]) assert.ok(library.includes(token), `measurement library should contain ${token}`);

for (const forbidden of ["firebase", "firestore", "cloud-backup", "backupPhoto", "setDoc(", "getDoc("]) {
  assert.equal(library.includes(forbidden), false, `Stage 9-3 storage must remain Local Only: ${forbidden}`);
}

for (const forbidden of ["weightKg", "bodyFatPercent", "skeletalMuscleKg", "waistCm", "BodyMeasurementEntry"]) {
  assert.equal(photoTypes.includes(forbidden), false, `PhotoItem must stay separate: ${forbidden}`);
}

assert.ok(
  photoLibrary.includes("detachBodyMeasurementsFromPhoto(id)") &&
    photoLibrary.includes("deleteLegacyPhoto(id)"),
  "shared photo deletion should detach measurement links before deleting the photo"
);
assert.ok(
  photoLibrary.indexOf("detachBodyMeasurementsFromPhoto(id)") <
    photoLibrary.indexOf("deleteLegacyPhoto(id)"),
  "measurement detachment should precede photo deletion"
);

for (const token of [
  "getBodyMeasurementSettings", "updateBodyMeasurementSettings", "measurementDraft",
  "수치 기록", "현재 기기에만 저장됩니다.", "기록 항목", "대표 수치",
  "촬영 후 기록 제안", "bodyMeasurementMetricMeta"
]) assert.ok(projectDetail.includes(token), `project measurement settings should contain ${token}`);

for (const token of [
  "BodyMeasurementEditorSheet", "getBodyMeasurementByPhotoId", "measurementSettings.enabled",
  "measurementEntry", "수치 기록", "현재 기기에만 저장됩니다.", "measurement?: string"
]) assert.ok(photoDetail.includes(token), `photo measurement UI should contain ${token}`);

for (const token of [
  "getBodyMeasurementSettings", "measurementPromptPhotoId", "measurementSettings.enabled",
  "measurementSettings.promptAfterCapture", 'measurement: "1"', "수치 기록"
]) assert.ok(camera.includes(token), `camera measurement suggestion should contain ${token}`);

for (const token of [
  "activeMetrics", 'keyboardType="decimal-pad"', "parseMeasurementInput",
  "saveBodyMeasurement", "deleteBodyMeasurement", "입력한 값은 현재 기기에만 저장됩니다."
]) assert.ok(editor.includes(token), `measurement editor should contain ${token}`);

const qa = fs.readFileSync("docs/manual-device-qa.md", "utf8");
for (const token of ["수치 기록을 켜고", "현재 기기에만 저장", "사진 연결만 해제", "촬영 후 기록 제안"]) {
  assert.ok(qa.includes(token), `manual QA should cover ${token}`);
}

console.log("Body Frame Stage 9-3 optional measurement contract passed.");
