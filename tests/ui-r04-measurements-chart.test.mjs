import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const files = [
  "features/records/BodyMeasurementHistoryScreen.tsx",
  "components/body-measurement-summary-card.tsx"
];
const [history, chart] = files.map((path) => readFileSync(path, "utf8"));
const workflow = readFileSync(".github/workflows/body-frame-device-qa.yml", "utf8");

test("UI-R04 screens parse as TSX and keep measurement data logic untouched", () => {
  files.forEach((file, index) => {
    const parsed = ts.createSourceFile(file, [history, chart][index], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, file + " has TSX parse errors");
  });
  for (const token of [
    'useState<BodyMeasurementPeriod>("all")',
    "isBodyMeasurementInPeriod(entry.recordedAt, selectedPeriod)",
    "getBodyMeasurementSeries(filteredEntries, selectedMetric)",
    "getBodyMeasurementSeriesSummary(series)",
    "getBodyMeasurementMetricValue(entry, selectedMetric)",
    "setSelectedPeriod(option.value)",
    "setSelectedMetric(metric)",
    "BodyMeasurementEditorSheet",
    "BodyHealthConnectImportCard",
    "onDeleted",
    "onImported={() => void reload()}",
    'router.push(("/photo/" + entry.photoId) as Href)'
  ]) assert.ok(history.includes(token), token);
  assert.ok(chart.includes("normalizeBodyMeasurementSparklinePoints"));
  assert.ok(chart.includes("getBodyMeasurementSeriesSummary(series)"));
});

test("UI-R04 chart explains values, dates, units and change without color-only meaning", () => {
  for (const token of [
    "CHART_HEIGHT = 92",
    "compact && styles.compactCard",
    "formatRangeDate(summary.first.recordedAt)",
    "formatRangeDate(summary.latest.recordedAt)",
    "range.min",
    "range.max",
    "summary.first.value",
    "summary.latest.value",
    "compact && changeText",
    "시작 대비",
    'accessibilityRole="image"',
    "metricLabel",
    "unit={meta.unit}"
  ]) assert.ok(chart.includes(token), token);
  assert.ok(chart.includes("최저 ") && chart.includes("최고 "));
  assert.ok(chart.includes("series.length >= 2") && chart.includes("series.length === 1"));
  assert.ok(!/backgroundColor:\s*(?:["']red["']|["']green["'])/.test(chart));
});

test("UI-R04 holds filters and values readable at 360dp and expanded width", () => {
  assert.ok(history.includes("const wideStats = contentWidth >= 560;"));
  assert.ok(history.includes("wide && styles.overviewStatWide"));
  assert.match(history, /overviewStatWide:\s*\{\s*width:\s*"24%"/);
  assert.match(history, /overviewStat:\s*\{[^}]*width:\s*"48%"[^}]*minWidth:\s*0/);
  assert.match(history, /periodButton:\s*\{[^}]*minWidth:\s*0[^}]*minHeight:\s*bodyFrameDesign\.minTouchSize/);
  assert.ok(history.includes("accessibilityLabel=\"기록 지표 선택, 좌우로 이동\""));
  assert.ok(history.includes("numberOfLines={1} style={[styles.periodButtonText"));
  assert.ok(history.includes("numberOfLines={2}"));
  assert.ok(history.includes("formatSummaryDate(seriesSummary.first.recordedAt)"));
  assert.ok(history.includes("formatSummaryDate(seriesSummary.latest.recordedAt)"));
  assert.ok(history.includes("styles.historyReading") && history.includes("styles.historyUnit"));
  assert.ok(history.includes("selectedMetric") && history.includes("selectedPeriod"));
});

test("UI-R04 retains neutral flat style and exact 4-device native evidence gate", () => {
  for (const s of [history, chart]) {
    assert.doesNotMatch(s, /border(?:Top|Right|Bottom|Left)Width\s*:/);
    assert.doesNotMatch(s, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
    assert.doesNotMatch(s, /react-native-svg|victory|react-native-chart/);
  }
  assert.ok(workflow.includes("ui-r04-verify:"));
  assert.ok(workflow.includes("startsWith(github.head_ref, 'ui/ui-r04-')"));
  for (const label of ["phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp"]) {
    assert.ok(workflow.includes(label));
  }
  assert.ok(workflow.includes("scripts/verify-frame-journal-c7.py --root artifacts/c7-captures"));
  assert.ok(workflow.includes("name: body-frame-ui-r04-report-"));
  assert.ok(!workflow.includes("[deploy-closed]"));
});
