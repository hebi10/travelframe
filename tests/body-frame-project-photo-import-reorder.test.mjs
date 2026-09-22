import assert from "node:assert/strict";
import fs from "node:fs";

const detail = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);
const records = fs.readFileSync(
  "features/records/BodyFrameRecordsScreen.tsx",
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
  "SortableProjectPhotoTile",
  "Gesture.Manual()",
  "PROJECT_PHOTO_PRE_DRAG_DISTANCE",
  "PROJECT_PHOTO_TAP_DISTANCE",
  ".onTouchesDown((event, manager) =>",
  ".onTouchesMove((event, manager) =>",
  ".onTouchesUp((event, manager) =>",
  "manager.activate()",
  "manager.end()",
  "manager.fail()",
  "dragActivated.value",
  "runOnJS(onDragHover)",
  "runOnJS(onDrop)",
  "scrollEnabled={!isPhotoDragging}",
  "setPhotoOrderMode(true)",
  "setPhotoDropTargetIndex",
  "moveProjectPhoto(",
  "orderedPhotoIds = [...nextDisplayedPhotos]",
  ".reverse()",
  "reorderBodyProjectPhotos",
  "사진을 길게 누른 채 원하는 위치로 끌어 놓으세요."
]) {
  assert.ok(detail.includes(token), `inline project drag reorder missing: ${token}`);
}

for (const removedGesture of [
  "activateAfterLongPress(PROJECT_PHOTO_LONG_PRESS_MS)",
  "Gesture.Exclusive(dragGesture, tapGesture)",
  "Gesture.Tap()"
]) {
  assert.ok(
    !detail.includes(removedGesture),
    `project reorder should not use the fragile long-press/tap race: ${removedGesture}`
  );
}

for (const removed of [
  "BodyFramePhotoOrderModal",
  "setOrderModalOpen",
  "onLongPress={() => setOrderModalOpen(true)}"
]) {
  assert.ok(
    !detail.includes(removed),
    `project reorder should not open a separate reorder screen: ${removed}`
  );
}

assert.ok(
  detail.includes('justifyContent: "flex-start"') &&
    records.includes('projectGrid: {') &&
    records.includes('justifyContent: "flex-start"'),
  "partial photo/project rows should fill from the left instead of spreading to both edges"
);

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

console.log("ok - project photo import and inline long-press drag reorder are wired");
