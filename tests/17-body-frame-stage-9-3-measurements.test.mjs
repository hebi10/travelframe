import assert from "node:assert/strict";
import fs from "node:fs";

const typesSource = fs.readFileSync("types/body-measurement.ts", "utf8");
const normalizationSource = fs.readFileSync(
  "lib/body-measurement-normalization.ts",
  "utf8"
);
const librarySource = fs.readFileSync(
  "lib/body-measurement-library.ts",
  "utf8"
);
const projectDetailSource = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);
const photoDetailSource = fs.readFileSync("app/photo/[id].tsx", "utf8");
const editorSource = fs.readFileSync(
  "features/records/BodyMeasurementEditorSheet.tsx",
  "utf8"
);
const cameraSource = fs.readFileSync(
  "features/camera/BodyFrameCameraScreen.tsx",
  "utf8"
);
const photoTypeSource = fs.readFileSync("types/photo.ts", "utf8");
const cloudBackupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const firestoreRules = fs.readFileSync("firestore.rules", "utf8");

for (const token of [
  'BodyMeasurementMetric',
  'BodyMeasurementSettings',
  'BodyMeasurementEntry',
  'weightKg?: number',
  'bodyFatPercent?: number',
  'skeletalMuscleKg?: number',
  'waistCm?: number',
  'source: "manual" | "health_connect"',
  'enabled: false',
  'promptAfterCapture: false'
]) {
  assert.ok(typesSource.includes(token), `measurement types should contain ${token}`);
}

for (const token of [
  'body-frame.measurements.v1',
  'body-frame.measurement-settings.v1',
  'getBodyMeasurementSettings',
  'updateBodyMeasurementSettings',
  'getBodyMeasurements',
  'getBodyMeasurementByPhotoId',
  'saveBodyMeasurement',
  'deleteBodyMeasurement',
  'detachBodyMeasurementsFromPhoto'
]) {
  assert.ok(librarySource.includes(token), `measurement library should contain ${token}`);
}

for (const token of [
  'weightKg: { min: 20, max: 500 }',
  'bodyFatPercent: { min: 1, max: 70 }',
  'skeletalMuscleKg: { min: 5, max: 150 }',
  'waistCm: { min: 30, max: 300 }',
  'normalizeBodyMeasurementEntry',
  'normalizeBodyMeasurementSettings'
]) {
  assert.ok(normalizationSource.includes(token), `measurement normalization should contain ${token}`);
}

for (const token of [
  '수치 기록',
  '현재 기기에만 저장됩니다.',
  '기록 항목',
  '대표 수치',
  '촬영 후 기록 제안',
  'updateBodyMeasurementSettings',
  'measurementDraft.enabled'
]) {
  assert.ok(projectDetailSource.includes(token), `project settings should contain ${token}`);
}

for (const token of [
  'BodyMeasurementEditorSheet',
  'getBodyMeasurementByPhotoId',
  'getBodyMeasurementSettings',
  'detachBodyMeasurementsFromPhoto',
  'measurementSettings.enabled',
  'measurementEntry ? "수정" : "추가"',
  '이 사진에 연결된 수치가 없습니다.'
]) {
  assert.ok(photoDetailSource.includes(token), `photo detail should contain ${token}`);
}

for (const token of [
  '수치 또는 메모를 하나 이상 입력해 주세요.',
  'decimal-pad',
  'saveBodyMeasurement',
  'deleteBodyMeasurement',
  '입력한 값은 현재 기기에만 저장됩니다.'
]) {
  assert.ok(editorSource.includes(token), `measurement editor should contain ${token}`);
}

for (const token of [
  'getBodyMeasurementSettings',
  'measurementSettings.enabled',
  'measurementSettings.promptAfterCapture',
  'measurementPromptPhotoId',
  '수치 기록',
  'measurement: "1"'
]) {
  assert.ok(cameraSource.includes(token), `camera optional prompt should contain ${token}`);
}

// Sensitive measurements must not hitchhike on the existing photo backup object.
for (const sensitiveField of [
  "weightKg",
  "bodyFatPercent",
  "skeletalMuscleKg",
  "waistCm"
]) {
  assert.equal(
    photoTypeSource.includes(sensitiveField),
    false,
    `PhotoItem must not contain measurement field ${sensitiveField}`
  );
  assert.equal(
    cloudBackupSource.includes(sensitiveField),
    false,
    `photo cloud backup must not include measurement field ${sensitiveField}`
  );
  assert.equal(
    firestoreRules.includes(sensitiveField),
    false,
    `existing Firestore photo backup rules must not include measurement field ${sensitiveField}`
  );
}

assert.ok(
  librarySource.includes('return {\n        ...entry,\n        photoId: undefined'),
  "deleting a photo should detach the link instead of deleting its measurement"
);

console.log("Body Frame Stage 9-3 local measurement contract passed.");
