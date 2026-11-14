import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");
const records = read("features/records/BodyFrameRecordsScreen.tsx");
const detail = read("features/records/BodyFrameProjectDetailScreen.tsx");

for (const [file, source] of [
  ["features/records/BodyFrameRecordsScreen.tsx", records],
  ["features/records/BodyFrameProjectDetailScreen.tsx", detail]
]) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(
    parsed.parseDiagnostics.length,
    0,
    file + " has invalid TSX: " + parsed.parseDiagnostics.map((d) => d.messageText).join("; ")
  );
}

assert.ok(records.includes("contentWidth >= 560 ? 2 : 1"), "mobile project list is one column, tablets two");
assert.ok(records.includes("width: projectCardWidth"));
assert.ok(
  records.includes("const coverWidth = fontScale >= 1.3") &&
  records.includes("Math.min(120, Math.max(100, Math.round(projectCardWidth * 0.32)))") &&
  records.includes("Math.min(144, Math.max(116, Math.round(projectCardWidth * 0.40)))"),
  "thumbnail width must remain bounded for normal and enlarged font scales"
);
assert.ok(records.includes('projectCard: {\n    minHeight: 154,\n    flexDirection: "row"'), "every card remains a readable photo-led row");
assert.ok(records.includes("formatProjectDate(project.createdAt)"));
assert.ok(!records.includes("singleProjectCard") && !records.includes("singleProjectCopy"));
assert.ok(records.includes('accessibilityLabel="바로 촬영"'));
assert.ok(records.includes("createOnly") && records.includes("onCreateProject={handleCreateProject}"));
assert.ok(records.includes("getProjectCover(project, photos)") && records.includes("cover.previewUri ?? cover.uri"));
assert.ok(records.includes("getBodyProjectProgressSummary(photos, project)"));
assert.ok(records.includes('accessibilityRole="progressbar"'));
assert.ok(records.includes("getBodyFrameProjectCreationLimitState"));
assert.ok(records.includes("archiveBodyProject(project.id, false)"));
assert.ok(records.includes('accessibilityLabel={`${project.name} 프로젝트 열기`}'));

assert.ok(detail.includes('useState<"records" | "metrics" | "stats">("records")'));
assert.ok(detail.includes('id: "records", label: "기록"'));
assert.ok(detail.includes('id: "metrics", label: "수치"'));
assert.ok(detail.includes('id: "stats", label: "통계"'));
assert.ok(detail.includes('accessibilityRole="tab"'));
assert.ok(detail.includes("accessibilityState={{ selected, disabled: isPhotoDragging || photoOrderSaving }}"));
assert.ok(detail.includes("disabled={isPhotoDragging || photoOrderSaving}"));
assert.ok(detail.includes('setDetailTab(tab.id)'));
assert.ok(detail.includes('numberOfLines={1} style={[styles.pageTitle'));
assert.ok(detail.includes("{project.name}</Text>"));

const recordsStart = detail.indexOf('detailTab === "records" ? (');
const metricsStart = detail.indexOf('detailTab === "metrics" ? (');
const statsStart = detail.indexOf('detailTab === "stats" ? (');
assert.ok(recordsStart > 0 && metricsStart > recordsStart && statsStart > metricsStart);
const recordsTab = detail.slice(recordsStart, metricsStart);
const metricTab = detail.slice(metricsStart, statsStart);
const statsTab = detail.slice(statsStart, detail.indexOf("</ScrollView>", statsStart));
assert.ok(recordsTab.indexOf("styles.comparePreviewCard") < recordsTab.indexOf("styles.projectHeader"), "before/after photos take visual priority");
assert.ok(recordsTab.includes("styles.photoGrid") && recordsTab.includes("SortableProjectPhotoTile"));
assert.ok(recordsTab.includes('contentFit="contain"'), "comparison previews must preserve uncropped photos");
assert.ok(recordsTab.includes("importProjectPhotos") && recordsTab.includes("handleProjectPhotoDrop"));
assert.ok(recordsTab.includes("styles.primaryAction") && recordsTab.includes("styles.videoAction"));
assert.ok(metricTab.includes("<BodyMeasurementSummaryCard") && metricTab.includes("onOpenHistory"));
assert.ok(metricTab.includes('pathname: "/project/[id]/measurements"'));
assert.ok(metricTab.includes("수치 기록을 사용하지 않는 프로젝트입니다."));
assert.ok(metricTab.includes("setSettingsOpen(true)"));
assert.ok(statsTab.includes("styles.statGrid") && statsTab.includes("formatDate(project.createdAt)"));
assert.ok(statsTab.includes('accessibilityLabel="프로젝트 촬영 알림 설정"'));
assert.ok(statsTab.includes("summary.photoCount") && statsTab.includes("progressPercent"));

for (const value of [
  "PhotoPositionSheet", "onMoveToPosition", "openReminderSettings",
  "measurementSettings.enabled", "poseAlignmentEnabled",
  "setRememberCaptureContextDraft", "confirmArchive",
  "BodyFrameSheetFooter", "setPhotoOrderMode"
]) assert.ok(detail.includes(value), "original detail action must remain available: " + value);

for (const source of [records, detail]) {
  assert.ok(!/border(?:Top|Bottom|Left|Right)Width\s*:/.test(source), "no one-sided decorative borders");
  assert.ok(!/shadowOpacity|shadowColor|elevation:|LinearGradient/.test(source), "no extra decoration");
}
const nativeQa = read("scripts/capture-android-qa.py");
assert.ok(!nativeQa.includes("프로젝트별 몸의 변화를"), "native QA must not wait for removed header description");
assert.ok(nativeQa.includes("('project-metrics', f'project/{PROJECT}'"), "real Android metrics tab screenshot is required");
assert.ok(nativeQa.includes("('project-stats', f'project/{PROJECT}'"), "real Android statistics tab screenshot is required");
assert.ok(nativeQa.includes("device.tap('통계')"), "reminder capture must navigate to the statistics tab");
assert.ok(nativeQa.includes("capture(device, directory, 'empty-projects', 'studio'"), "empty project QA must remain available");

console.log("ok - Stage 10 photo-led records and record/metric/stat navigation preserve existing actions");
