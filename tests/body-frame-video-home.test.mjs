import assert from "node:assert/strict";
import fs from "node:fs";

const tabRoute = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");
const home = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "utf8"
);
const library = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoLibraryScreen.tsx",
  "utf8"
);
const creator = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "utf8"
);
const rootLayout = fs.readFileSync("app/_layout.tsx", "utf8");

assert.ok(
  tabRoute.includes("BodyFrameVideoHomeScreen"),
  "video tab should open the video home instead of the creator"
);

for (const token of [
  "변화 영상 만들기",
  "영상 만들기",
  "프로젝트",
  "저장한 영상",
  'router.push("/video-create")',
  'router.push("/video-library")',
  "getBodyProjects",
  "getMadeVideos"
]) {
  assert.ok(home.includes(token), `video home should contain ${token}`);
}

for (const removed of [
  "ImagePicker",
  "PaginatedPhotoGrid",
  "앱에 이미지 저장",
  "이미지 선택",
  "/legacy-studio"
]) {
  assert.equal(
    home.includes(removed),
    false,
    `video home should not expose photo-library content: ${removed}`
  );
}

for (const token of [
  "useSafeAreaInsets",
  "paddingTop: Math.max(insets.top + 12, 20)",
  "paddingBottom: insets.bottom + 36",
  'accessibilityLabel="영상 화면으로 돌아가기"',
  "onPress={() => router.back()}",
  "영상 관리",
  "getMadeVideos",
  "deleteMadeVideo"
]) {
  assert.ok(library.includes(token), `video library should contain ${token}`);
}

for (const token of [
  "getGuestWeeklyVideoExportUsage",
  "recordGuestWeeklyVideoExport",
  'router.push("/video-library")',
  "비로그인 영상 출력"
]) {
  assert.ok(creator.includes(token), `video creator should contain ${token}`);
}

assert.equal(
  creator.includes('router.push("/legacy-studio")'),
  false,
  "Body Frame video creator should no longer open the photo-heavy legacy studio"
);

for (const route of ["video-create", "video-library"]) {
  assert.ok(
    rootLayout.includes(`<Stack.Screen name="${route}" options={{ headerShown: false }} />`),
    `${route} should use the in-screen Body Frame header`
  );
}

console.log("ok - video tab is focused on projects and saved videos with dedicated management");
