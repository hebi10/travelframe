import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");
const periodSource = read("features/records/body-measurement-period.ts");
const javascript = ts.transpileModule(periodSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const period = await import(`data:text/javascript,${encodeURIComponent(javascript)}`);

const endOfMarch = new Date(2026, 2, 31, 12, 0, 0);
const lastFebruaryDay = new Date(period.getBodyMeasurementPeriodStart("1m", endOfMarch));
assert.equal(lastFebruaryDay.getFullYear(), 2026);
assert.equal(lastFebruaryDay.getMonth(), 1);
assert.equal(lastFebruaryDay.getDate(), 28, "month subtraction must clamp leap and short months");
assert.equal(lastFebruaryDay.getHours(), 0);
assert.equal(period.getBodyMeasurementPeriodStart("all", endOfMarch), null);
assert.ok(period.getBodyMeasurementPeriodStart("6m", endOfMarch) <
          period.getBodyMeasurementPeriodStart("3m", endOfMarch));
assert.ok(period.getBodyMeasurementPeriodStart("3m", endOfMarch) <
          period.getBodyMeasurementPeriodStart("1m", endOfMarch));
assert.equal(period.isBodyMeasurementInPeriod("2026-03-01T12:00:00.000Z", "1m", endOfMarch), true);
assert.equal(period.isBodyMeasurementInPeriod("2025-12-20T12:00:00.000Z", "1m", endOfMarch), false);
assert.equal(period.isBodyMeasurementInPeriod("2025-12-20T12:00:00.000Z", "all", endOfMarch), true);
assert.equal(period.isBodyMeasurementInPeriod("not-a-date", "all", endOfMarch), false);

const camera = read("features/camera/BodyFrameCameraScreen.tsx");
const switcher = read("features/camera/BodyFrameProjectSwitcher.tsx");
const records = read("features/records/BodyFrameRecordsScreen.tsx");
const detail = read("features/records/BodyFrameProjectDetailScreen.tsx");
const compare = read("features/records/BodyFrameCompareScreen.tsx");
const history = read("features/records/BodyMeasurementHistoryScreen.tsx");

assert.ok(camera.includes("pointerEvents=\"none\"") && camera.includes("styles.captureHintPanel"));
assert.ok(camera.includes("accessibilityLiveRegion=\"polite\""));
assert.ok(camera.includes("captureBlockedReason") && camera.includes("measurementPromptPhotoId"));
assert.ok(switcher.includes("accessibilityHint={createOnly"));
assert.ok(switcher.includes("onCreateProject") && switcher.includes("onSelectProject"));

assert.ok(records.includes("contentWidth >= 560 ? 2 : 1"), "tablet layout should show two photo-first cards per row and mobile one");
assert.ok(records.includes("width: projectCardWidth"), "responsive card widths must remain measured");
assert.ok(records.includes("flexDirection: \"row\"") && !records.includes("singleProjectCard"), "all projects use photo-first row cards");
assert.ok(records.includes("styles.projectGrid") && records.includes("styles.coverFrame"));
assert.ok(records.includes('accessibilityRole="progressbar"'));
assert.ok(records.includes("styles.coverEmptyArtwork") && records.includes("empty-project.png"));
assert.ok(records.includes("archiveBodyProject") && records.includes("restoreProject"));

assert.ok(detail.includes("sortProjectPhotos(getBodyProjectPhotos(photos, project.id))"));
assert.ok(detail.includes("getBodyFrameComparisonPhotos(projectPhotos, project.id)"));
assert.ok(detail.includes("const firstPhoto = comparisonPreview?.before"));
assert.ok(detail.includes("const latestPhoto = comparisonPreview?.after"));
assert.ok(detail.includes("styles.comparePreviewPair") && detail.includes("styles.comparePreviewImage"));
assert.ok(detail.includes('accessibilityLabel="프로젝트 첫 사진과 마지막 사진 비교"'));
assert.ok(detail.includes("contentFit=\"contain\""), "body photo preview must not crop the user");
assert.ok(detail.includes('accessibilityRole="progressbar"'));
assert.ok(detail.includes("primaryBackground: primaryColor"));
assert.ok(detail.includes('router.push("/camera")'));
assert.ok(detail.indexOf("<BodyMeasurementSummaryCard") <
          detail.indexOf('accessibilityLabel="프로젝트 촬영 알림 설정"'),
          "measurement summary should lead secondary information ahead of reminders");
assert.ok(detail.includes("PhotoPositionSheet") && detail.includes("onMoveToPosition"));

assert.ok(compare.includes("PanResponder.create"));
assert.ok(compare.includes('accessibilityRole="adjustable"'));
assert.ok(compare.includes("onAccessibilityAction") && compare.includes('actionName === "increment"'));
assert.ok(compare.includes("styles.dividerHandle"));
assert.ok(compare.includes('pointerEvents="none"'), "drag handle must not intercept touch gestures");
assert.ok(compare.includes("changeDivider(value)"));

assert.ok(history.includes('useState<BodyMeasurementPeriod>("all")'), "existing full-history behavior is default");
assert.ok(history.includes("isBodyMeasurementInPeriod(entry.recordedAt, selectedPeriod)"));
assert.ok(history.includes("getBodyMeasurementSeries(filteredEntries, selectedMetric)"));
assert.ok(history.includes("[...filteredEntries]"), "chart and list must share one filtered range");
assert.ok(history.indexOf("styles.periodSelector") <
          history.indexOf("styles.overviewGrid"), "period filter must appear before summary stats");
assert.ok(history.includes("selectedPeriod === option.value") && history.includes('accessibilityRole="radio"'));
assert.ok(history.includes("BodyMeasurementEditorSheet") && history.includes("onDeleted"));

for (const src of [camera,switcher,records,detail,compare,history]) {
  assert.equal(/border(?:Top|Bottom|Left|Right)Width\s*:/.test(src), false);
  assert.equal(/shadowOpacity|shadowColor|elevation:|LinearGradient/.test(src), false);
}
console.log("ok - Stage 2 camera, photo grid, comparison and measurements contract");
