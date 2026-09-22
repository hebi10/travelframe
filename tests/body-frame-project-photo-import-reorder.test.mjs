import assert from "node:assert/strict";
import fs from "node:fs";

const detail = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);
const orderModal = fs.readFileSync(
  "features/records/BodyFramePhotoOrderModal.tsx",
  "utf8"
);
const legacyPhotoLibrary = fs.readFileSync(
  "lib/legacy-photo-library.ts",
  "utf8"
);
const photoLibrary = fs.readFileSync("lib/photo-library.ts", "utf8");
const measurementLibrary = fs.readFileSync(
  "lib/body-measurement-library.ts",
  "utf8"
);

for (const token of [
  "launchImageLibraryAsync",
  "allowsMultipleSelection: true",
  'label: "프로젝트 가져온 사진"',
  "saveCapturedPhoto",
  "projectId: project.id",
  "selectionLimit: Math.min(20, remaining)",
  "backupPhotoIfEnabled",
  '"사진 추가"'
]) {
  assert.ok(detail.includes(token), `project photo import missing: ${token}`);
}

for (const token of [
  "BodyFramePhotoOrderModal",
  "onLongPress={() => setOrderModalOpen(true)}",
  '"순서 조정"',
  "reorderBodyProjectPhotos"
]) {
  assert.ok(detail.includes(token), `project reorder entry missing: ${token}`);
}

for (const token of [
  "activateAfterLongPress",
  "Gesture.Pan()",
  "runOnJS(onDrop)",
  "gridWidth >= 520 ? 7 : gridWidth >= 420 ? 6 : 5",
  "왼쪽 위가 첫 번째 기록",
  "순서 저장"
]) {
  assert.ok(orderModal.includes(token), `compact drag reorder missing: ${token}`);
}

assert.ok(
  legacyPhotoLibrary.includes("reorderProjectPhotos") &&
    legacyPhotoLibrary.includes("sequenceById") &&
    legacyPhotoLibrary.includes("updatedAt"),
  "photo order should persist as project sequence metadata and invalidate stale backups"
);

assert.ok(
  photoLibrary.includes("reorderBodyProjectPhotos") &&
    photoLibrary.includes("syncBodyMeasurementPhotoSequences") &&
    photoLibrary.includes("coverPhotoId"),
  "project reorder should coordinate cover and measurement metadata"
);

assert.ok(
  measurementLibrary.includes("syncBodyMeasurementPhotoSequences"),
  "measurement sequence should follow reordered project photos"
);

console.log("ok - project photo import and compact long-press drag reorder are wired");
