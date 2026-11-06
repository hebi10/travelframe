import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");
const records = read("features/records/BodyFrameRecordsScreen.tsx");
const project = read("features/records/BodyFrameProjectDetailScreen.tsx");
const videoHome = read("features/trip-clip/BodyFrameVideoHomeScreen.tsx");
const videoCreate = read("features/trip-clip/BodyFrameVideoScreen.tsx");
const settings = read("features/settings/BodyFrameSettingsScreen.tsx");

for (const file of [
  "features/records/BodyFrameRecordsScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx"
]) {
  const parsed = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0, file + " must parse");
}

assert.ok(records.includes("contentWidth >= 560 ? 2 : 1"), "mobile project list must use full-width photo-first rows");
assert.ok(records.includes("const coverWidth = contentWidth >= 560 ? 104 : 92"), "project covers must remain readable");
assert.ok(records.includes("cards.length === 0 ? (") && records.includes("프로젝트를 만들고 같은 구도의 사진을 기록하세요."));
assert.ok(records.includes("프로젝트 열기") && records.includes('name="chevron-right"'));
assert.ok(records.includes('accessibilityRole="progressbar"'));
assert.ok(records.includes('aspectRatio: 3 / 4'));
assert.ok(records.includes('minHeight: 118'));
assert.ok(records.includes("styles.singleProjectCard"));
assert.ok(records.includes("restoreProject") && records.includes("getProjectCover"));

assert.ok(project.includes('style={[styles.pageTitle, { color: palette.text }]}>{project.name}</Text>'));
assert.ok(!project.includes('style={[styles.projectName, { color: palette.text }]}'));
assert.ok(project.includes("styles.comparePreviewPair") && project.includes("styles.comparePreviewImage"));
assert.ok(project.includes('contentFit="contain"'), "body comparison photos must not be cropped");
assert.ok(project.includes("height: 148"), "comparison thumbnails should not push the photo grid too far below the fold");
assert.ok(project.includes('accessibilityLabel="프로젝트 사진 기록 진행률"'));
assert.ok(project.indexOf("styles.comparePreviewPair") < project.indexOf("styles.recordsSection"));
assert.ok(project.includes("PhotoPositionSheet") && project.includes("BodyMeasurementSummaryCard"));
assert.ok(project.includes("onPress={() => void openCamera()}"));

assert.ok(videoHome.includes('require("../../assets/ui/illustrations/feature-video.png")'));
assert.ok(videoHome.includes("styles.heroIllustration") && videoHome.includes("styles.heroCopy"));
assert.ok(videoHome.includes('router.push("/video-library")'));
assert.ok(videoHome.includes('styles.projectCoverImage') && videoHome.includes('styles.videoPlayIndicator'));
assert.ok(videoCreate.includes("windowWidth * 0.82"));
assert.ok(videoCreate.includes('width: "82%"'));
assert.ok(videoCreate.includes("minHeight: bodyFrameDesign.primaryButtonHeight"));
assert.ok(videoCreate.includes("TripClipRecordingCanvas"));
assert.ok(videoCreate.includes("saveMadeVideo("));

assert.ok(settings.includes("minHeight: 64") && settings.includes("minHeight: 56"));
for(const group of ["촬영","저장 및 백업","변화 영상","화면","계정 및 플랜","정보 및 개인정보"]) {
  assert.ok(settings.includes('SectionBlock title="' + group + '"'));
}
assert.ok(settings.includes("saveAppSettings(") && settings.includes('setActiveSetting("fontStyle")'));
assert.ok(settings.includes("minHeight: bodyFrameDesign.minTouchSize"), "compact controls retain 44dp accessibility");

for (const source of [records,project,videoHome,videoCreate,settings]) {
  assert.ok(!/border(?:Top|Bottom|Left|Right)Width\s*:/.test(source), "no one-sided borders");
  assert.ok(!/shadowOpacity|shadowColor|elevation:|LinearGradient/.test(source), "no new decorative effects");
}
console.log("ok - photo-first layout, visible previews, compact controls and unchanged recording behavior");
