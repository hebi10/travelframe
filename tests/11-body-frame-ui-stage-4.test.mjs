import assert from "node:assert/strict";
import fs from "node:fs";

const detailSource = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);
const recordsSource = fs.readFileSync(
  "features/records/BodyFrameRecordsScreen.tsx",
  "utf8"
);
const projectSwitcherSource = fs.readFileSync(
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "utf8"
);
const rootLayoutSource = fs.readFileSync("app/_layout.tsx", "utf8");

for (const token of [
  "오늘 사진 찍기",
  "변화 영상 만들기",
  "projectPhotos",
  "getBodyProjectPhotos",
  "PROJECT_PHOTO_GRID_COLUMNS = 3",
  "projectPhotoTileWidth",
  "tileHeight = tileWidth * (4 / 3)",
  "photoMetaOverlay",
  "formatDate(project.createdAt)",
  "progressPercent",
  "setSettingsOpen(true)",
  "프로젝트 설정",
  "updateBodyProject",
  "archiveBodyProject",
  '"latest"',
  '"first"',
  'router.push("/camera")',
  'router.push("/trip-clip")',
  "setLastActiveProjectId"
]) {
  assert.ok(
    detailSource.includes(token),
    `Body Frame project detail should contain ${token}`
  );
}

assert.ok(
  detailSource.indexOf("오늘 사진 찍기") <
    detailSource.indexOf("프로젝트 설정", detailSource.indexOf("<Modal")),
  "record-first actions should appear before project settings content"
);

assert.equal(
  detailSource.includes("프로젝트 정보"),
  false,
  "project detail body should no longer lead with the settings form"
);

assert.ok(
  detailSource.includes("Modal") &&
    detailSource.includes("visible={settingsOpen}") &&
    detailSource.includes("프로젝트 보관"),
  "legacy project editing should remain available inside the project settings sheet"
);

for (const token of [
  "BodyFrameProjectSwitcher",
  "createOnly",
  "handleCreateProject",
  "createBodyProject",
  "getBodyFrameProjectCreationLimitState"
]) {
  assert.ok(recordsSource.includes(token), `records screen should contain ${token}`);
}

for (const token of ["createOnly", "openCreateSheet", "새 프로젝트 만들기"]) {
  assert.ok(
    projectSwitcherSource.includes(token),
    `project switcher creation-only entry should contain ${token}`
  );
}

assert.ok(
  rootLayoutSource.includes(
    '<Stack.Screen name="photo/[id]" options={{ headerShown: false }} />'
  ),
  "photo detail should hide the duplicate native stack header"
);

console.log("Body Frame UI Stage 4 project-detail and records-entry contracts passed.");
