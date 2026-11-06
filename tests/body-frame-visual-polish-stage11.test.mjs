import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (p) => fs.readFileSync(p, "utf8");

const files = [
  "components/tab-glyph.tsx",
  "features/records/BodyFrameRecordsScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "features/trip-clip/BodyFrameVideoLibraryScreen.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx"
];
for (const file of files) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0, file + " must remain valid TSX");
}

const records = read(files[1]);
const project = read(files[2]);
const home = read(files[3]);
const video = read(files[4]);
const library = read(files[5]);
const settings = read(files[6]);
const tabs = read(files[0]);

// Stage 10 navigation and responsive photo-first records cannot be reverted by a stale PR.
assert.ok(records.includes("contentWidth >= 560 ? 2 : 1"), "keep Stage 10 mobile rows / tablet two-column cards");
assert.ok(records.includes("styles.projectGrid") && records.includes("styles.coverFrame"));
assert.ok(records.includes("getBodyProjectProgressSummary(photos, project)"));
assert.ok(records.includes("새 프로젝트를 만들면 사진 기록이 여기에 표시됩니다."));
assert.ok(!records.includes("위의 새 프로젝트 버튼으로 프로젝트를 만든 뒤"));
assert.ok(records.includes("restoreProject") && records.includes("archiveBodyProject"));
assert.ok(project.includes('useState<"records" | "metrics" | "stats">("records")'), "Stage 10 detail tabs must remain");
assert.ok(project.includes('id: "records", label: "기록"'));
assert.ok(project.includes('id: "metrics", label: "수치"'));
assert.ok(project.includes('id: "stats", label: "통계"'));
assert.ok(project.includes("PhotoPositionSheet") && project.includes("BodyMeasurementSummaryCard"));
assert.ok(project.includes("styles.comparePreviewPair") && project.includes('contentFit="contain"'));

assert.ok(home.includes('require("../../assets/ui/illustrations/feature-video.png")'));
assert.ok(home.includes("styles.heroIllustrationFrame") && home.includes("styles.heroHeader"));
assert.ok(home.includes("styles.projectCoverImage") && home.includes("styles.videoPlayIndicator"));
assert.ok(home.includes('router.push("/video-library")'));
assert.ok(home.includes("getBodyProjectPhotos(photos, project.id)"));
assert.ok(video.includes("windowWidth * 0.82") && video.includes('width: "82%"'));
assert.ok(video.includes("minHeight: bodyFrameDesign.primaryButtonHeight"));
assert.ok(video.includes("TripClipRecordingCanvas") && video.includes("saveMadeVideo("));
assert.ok(library.includes("프로젝트 사진으로 첫 변화 영상을 만들어 보세요."));
assert.ok(library.includes("deleteMadeVideo(video.id)"));
assert.ok(library.includes("confirmDelete(video)"));

assert.ok(tabs.includes('studio: "image"') && tabs.includes('video: "youtube"'));
assert.ok(settings.includes("const settingRowIcons: Record<string, keyof typeof Feather.glyphMap>"));
assert.ok(settings.includes("const iconName = settingRowIcons[label]"));
assert.ok(settings.includes("size={18} color={palette.muted}"));
assert.ok(settings.includes("minHeight: 64") && settings.includes("minHeight: 56"));
assert.ok(settings.includes("minHeight: bodyFrameDesign.minTouchSize"), "tap controls must remain 44dp or larger");
for(const group of ["촬영", "저장 및 백업", "변화 영상", "화면", "계정 및 플랜", "정보 및 개인정보"]) {
  assert.ok(settings.includes('SectionBlock title="' + group + '"'), group + " setting group must remain");
}
assert.ok(settings.includes("saveAppSettings(") && settings.includes('setActiveSetting("fontStyle")'));
for (const src of [records, project, home, video, settings]) {
  assert.ok(!/border(?:Top|Bottom|Left|Right)Width\s*:/.test(src), "avoid one-sided borders");
  assert.ok(!/shadowOpacity|shadowColor|elevation:|LinearGradient/.test(src), "avoid unintended shadows/gradients");
}
console.log("ok - Stage 10-safe photo-led videos, icons, settings and empty states");
