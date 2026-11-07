import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const files = [
  "features/settings/BodyFrameSettingsScreen.tsx",
  "features/records/BodyMeasurementHistoryScreen.tsx",
  "components/body-measurement-summary-card.tsx",
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "features/records/BodyFrameRecordsScreen.tsx"
];
const [settings, metrics, chart, videos, records] = files.map(read);

test("Stage A four screens and optional chart layout parse without changing app flows", () => {
  for (let i = 0; i < files.length; i += 1) {
    const source = ts.createSourceFile(files[i], read(files[i]), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(source.parseDiagnostics.length, 0, files[i] + " must parse");
    assert.doesNotMatch(read(files[i]), /border(?:Top|Bottom|Left|Right)Width\\s*:|shadowOpacity|shadowColor|elevation\\s*:|LinearGradient/);
  }
});

test("Stage A settings keep six groups and accessible full details with denser rows", () => {
  for (const section of ["촬영", "저장 및 백업", "변화 영상", "화면", "계정 및 플랜", "정보 및 개인정보"]) {
    assert.ok(settings.includes('SectionBlock title="' + section + '"'));
  }
  assert.match(settings, /settingRow:\\s*\\{[^}]*minHeight:\\s*52/);
  assert.match(settings, /settingRow:\\s*\\{[^}]*paddingVertical:\\s*6/);
  assert.ok(settings.includes("showDetail && detail"));
  assert.ok(settings.includes("accessibilityHint={onPress ? detail : undefined}"));
  assert.ok(settings.includes("showDetail={!planEntitlements.canBackupToCloud}"));
  for (const token of ["saveAppSettings(", "setActiveSetting(\"fontStyle\")", "getPlanEntitlements", "router.push(\"/account\")"]) {
    assert.ok(settings.includes(token), token);
  }
});

test("Stage A measurements show recorded chart dates and retain data/filter/edit coverage", () => {
  assert.ok(metrics.includes("<BodyMeasurementSummaryCard"));
  assert.ok(metrics.includes("          compact\\n"));
  assert.ok(chart.includes("compact && styles.compactCard"));
  assert.ok(chart.includes("formatRangeDate(summary.first.recordedAt)"));
  assert.ok(chart.includes("formatRangeDate(summary.latest.recordedAt)"));
  assert.match(metrics, /overviewStat:\\s*\\{[^}]*minHeight:\\s*60/);
  assert.ok(metrics.includes('accessibilityLabel="기록 지표 선택, 좌우로 이동"'));
  for (const token of [
    "setSelectedMetric(metric)", "setSelectedPeriod(option.value)",
    "seriesSummary.first", "seriesSummary.latest", "seriesSummary.change", "seriesSummary.count",
    "BodyMeasurementEditorSheet", "BodyHealthConnectImportCard", "getBodyMeasurements("
  ]) assert.ok(metrics.includes(token), token);
});

test("Stage A video home prioritizes existing saves without breaking empty projects and video policies", () => {
  assert.ok(videos.includes("const savedVideosSection = ("));
  assert.ok(videos.indexOf("recentVideos.length > 0 ? savedVideosSection") <
    videos.indexOf('>프로젝트</Text>'));
  assert.ok(videos.includes("recentVideos.length === 0 ? savedVideosSection"));
  assert.ok(videos.includes('router.push("/video-library")'));
  assert.ok(videos.includes("startVideo(project)"));
  assert.ok(videos.includes("getGuestWeeklyVideoExportUsage"));
  assert.ok(videos.includes("비로그인 사용자는 주 1회 출력"));
  assert.match(videos, /heroIllustrationFrame:\\s*\\{[^}]*height:\\s*80/);
  assert.equal((videos.match(/<Text style=\\{\\[styles.emptyTitle/g) ?? []).length >= 1, true);
});

test("Stage A project cards increase photo/record prominence with original ownership and touch contracts", () => {
  assert.ok(records.includes("Math.round(projectCardWidth * 0.36)"));
  assert.ok(records.includes("Math.min(128, Math.max(108"));
  assert.ok(records.includes("기록 {summary.photoCount} / {summary.targetPhotoCount}장"));
  assert.match(records, /progressTrack:\\s*\\{[^}]*height:\\s*6/);
  for (const token of [
    "cover.previewUri ?? cover.uri", "accessibilityRole=\"progressbar\"",
    "width: projectCardWidth", "getBodyFrameProjectCreationLimitState",
    "archiveBodyProject(project.id, false)", "createOnly",
    "onCreateProject={handleCreateProject}", 'router.push("/camera")'
  ]) assert.ok(records.includes(token), token);
});
