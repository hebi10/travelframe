import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const paths = [
  "components/tab-glyph.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx",
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx"
];
for (const path of paths) {
  const parsed = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0, path + " must parse without TSX syntax errors");
}

const tabs = read(paths[0]);
const settings = read(paths[1]);
const videoHome = read(paths[2]);
const videoCreate = read(paths[3]);
const records = read("features/records/BodyFrameRecordsScreen.tsx");
const detail = read("features/records/BodyFrameProjectDetailScreen.tsx");

assert.ok(tabs.includes('studio: "image"') && tabs.includes('video: "youtube"'));
assert.ok(settings.includes("const settingRowIcons: Record<string, keyof typeof Feather.glyphMap>"));
assert.ok(settings.includes("styles.settingRowIcon") && settings.includes("size={18} color={palette.muted}"));
assert.ok(settings.includes("minHeight: 64") && settings.includes("minHeight: 56"));
for (const group of ["촬영", "저장 및 백업", "변화 영상", "화면", "계정 및 플랜", "정보 및 개인정보"]) {
  assert.ok(settings.includes('SectionBlock title="' + group + '"'));
}
assert.ok(settings.includes("saveAppSettings("));
assert.ok(settings.includes('setActiveSetting("fontStyle")'));
assert.ok(settings.includes("minHeight: bodyFrameDesign.minTouchSize"));

assert.ok(videoHome.includes('require("../../assets/ui/illustrations/feature-video.png")'));
assert.ok(videoHome.includes("styles.heroHeader") && videoHome.includes("styles.heroIllustration"));
assert.ok(videoHome.includes('router.push("/video-library")'));
assert.ok(videoHome.includes("styles.projectCoverImage"));
assert.ok(videoCreate.includes("windowWidth * 0.82"));
assert.ok(videoCreate.includes('width: "82%"') && videoCreate.includes("maxWidth: 360"));
assert.ok(videoCreate.includes("minHeight: bodyFrameDesign.primaryButtonHeight"));
assert.ok(videoCreate.includes("TripClipRecordingCanvas"));
assert.ok(videoCreate.includes("saveMadeVideo("));

assert.ok(records.includes("contentWidth >= 560 ? 2 : 1"), "preserve the merged Stage 10 photo-first project list");
assert.ok(records.includes("새 프로젝트를 만든 후 같은 구도로 사진을 기록해 보세요."));
assert.ok(!records.includes("위의 새 프로젝트 버튼으로"), "empty state must avoid duplicate directions");
assert.ok(detail.includes('id: "metrics", label: "수치"') && detail.includes('id: "stats", label: "통계"'), "preserve Stage 10 project tabs");
assert.ok(detail.includes("styles.projectTabs"));
for (const source of [tabs,settings,videoHome,videoCreate]) {
  assert.ok(!/border(?:Top|Bottom|Left|Right)Width\s*:/.test(source), "no one-sided borders");
  assert.ok(!/shadowOpacity|shadowColor|elevation:|LinearGradient/.test(source), "no decorative shadows or gradients");
}
console.log("ok - Stage 11 media/settings/icons with Stage 10 records and project tabs preserved");
