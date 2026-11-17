import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const header = fs.readFileSync("features/trip-clip/components/TripClipHeader.tsx", "utf8");
const editRoute = fs.readFileSync("app/legacy-video-edit.tsx", "utf8");
const videoDetail = fs.readFileSync("app/video/[id].tsx", "utf8");
const styles = fs.readFileSync("features/trip-clip/trip-clip-screen.styles.ts", "utf8");

test("saved-video editing has context-specific, accessible title and save action", () => {
  for (const required of [
    'isEditingMadeVideo ? "영상 재편집" : "영상 만들기"',
    'isEditingMadeVideo ? "저장한 영상 편집" : "동영상"',
    '"저장한 영상의 사진과 편집 설정을 확인하고 수정할 수 있습니다."',
    'accessibilityLabel={isEditingMadeVideo ? "편집한 영상 저장" : "영상 작업 임시 저장"}',
    'accessibilityLabel="영상 작업 이름"',
    'disabled={isLoading || isExporting}'
  ]) assert.ok(header.includes(required), `Missing edit copy/accessibility: ${required}`);
});

test("legacy project restoration, app palette and saved-video route remain unchanged", () => {
  assert.ok(editRoute.includes('import TripClipScreen from "@/features/trip-clip/TripClipScreen"'));
  assert.ok(videoDetail.includes('pathname: "/legacy-video-edit"'));
  assert.ok(styles.includes('export const createTripClipStyles = (colors: AppPalette)'));
  assert.ok(styles.includes("useAppAppearance"));
  assert.ok(header.includes("resumeTripClipDraft"));
  assert.ok(header.includes("removeTripClipDraft"));
  assert.ok(header.includes("onChangeText={setWorkTitle}"));
  assert.ok(header.includes("onPress={handleHeaderSavePress}"));
});
