import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const history = readFileSync("features/records/BodyMeasurementHistoryScreen.tsx", "utf8");
const chart = readFileSync("components/body-measurement-summary-card.tsx", "utf8");

test("UI-R10-02B TSX parses and preserves measurement filters and persistence", () => {
  for (const [file, source] of [
    ["features/records/BodyMeasurementHistoryScreen.tsx", history],
    ["components/body-measurement-summary-card.tsx", chart]
  ]) {
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, file);
  }
  for (const token of [
    'useState<BodyMeasurementPeriod>("all")',
    'isBodyMeasurementInPeriod(entry.recordedAt, selectedPeriod)',
    "getBodyMeasurementSeries(filteredEntries, selectedMetric)",
    "getBodyMeasurementSeriesSummary(series)",
    "setSelectedPeriod(option.value)",
    "setSelectedMetric(metric)",
    "BodyMeasurementEditorSheet",
    "BodyHealthConnectImportCard",
    "onImported={() => void reload()}",
    "onDeleted"
  ]) assert.ok(history.includes(token), token);
});

test("UI-R10-02B puts current value and start delta before the chart and recent records", () => {
  const start = history.indexOf('        <View style={styles.overviewGrid}');
  const chartAt = history.indexOf("        <BodyMeasurementSummaryCard", start);
  const listAt = history.indexOf("        <View style={styles.historySection}>", chartAt);
  assert.ok(start >= 0 && chartAt > start && listAt > chartAt);
  const grid = history.slice(start, chartAt);
  const labels = [...grid.matchAll(/label="(현재|변화|시작|기록)"/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["현재", "변화", "시작", "기록"]);
  assert.ok(grid.includes("prominent") && history.includes("styles.overviewStatProminent"));
  assert.ok(history.includes("styles.overviewValueProminent"));
  assert.ok(history.includes("chartOnly"));
  assert.ok(history.includes('dateLabel="시작 대비"'));
  assert.ok(history.includes("seriesSummary.change"));
});

test("UI-R10-02B sparkline has numeric y-axis with unchanged data mapping and dates", () => {
  for (const token of [
    "CHART_HEIGHT = 92",
    "normalizeBodyMeasurementSparklinePoints",
    "getBodyMeasurementSeriesSummary(series)",
    "styles.chartRow",
    "styles.chartAxis",
    "axisLabelColor={palette.muted}",
    "axisLabels",
    "new Intl.NumberFormat",
    "styles.chartGuide",
    "chartOnly && styles.chartOnlyCard",
    "formatRangeDate(summary.first.recordedAt)",
    "formatRangeDate(summary.latest.recordedAt)",
    "시작 대비",
    'accessibilityRole="image"',
    "meta.unit"
  ]) assert.ok(chart.includes(token), token);
  assert.ok(chart.includes("series.length >= 2") && chart.includes("series.length === 1"));
  assert.doesNotMatch(chart, /react-native-svg|victory|react-native-chart/);
});

test("UI-R10-02B preserves color-neutral meaning and Android touch targets", () => {
  for (const src of [history, chart]) {
    assert.doesNotMatch(src, /border(?:Top|Right|Bottom|Left)Width\s*:/);
    assert.doesNotMatch(src, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
  }
  assert.ok(history.includes('const wideStats = contentWidth >= 560;'));
  assert.ok(history.includes('minHeight: bodyFrameDesign.minTouchSize'));
});
