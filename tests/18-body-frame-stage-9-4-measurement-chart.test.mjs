import assert from "node:assert/strict";
import fs from "node:fs";

const helper = fs.readFileSync("lib/body-measurement-series.ts", "utf8");
const card = fs.readFileSync(
  "components/body-measurement-summary-card.tsx",
  "utf8"
);
const detail = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);

for (const token of [
  "getBodyMeasurementMetricValue",
  "getBodyMeasurementSeries",
  "getBodyMeasurementSeriesSummary",
  "normalizeBodyMeasurementSparklinePoints",
  "recordedAt",
  "change:"
]) {
  assert.ok(helper.includes(token), `measurement series helper should contain ${token}`);
}

for (const token of [
  "BodyMeasurementSummaryCard",
  "CHART_HEIGHT = 92",
  "series.length >= 2",
  "series.length === 1",
  "수치 기록 추가",
  "시작 대비",
  "시작",
  "최근",
  "onLayout"
]) {
  assert.ok(card.includes(token), `measurement summary card should contain ${token}`);
}

assert.equal(
  card.includes("react-native-svg") ||
    card.includes("victory") ||
    card.includes("react-native-chart"),
  false,
  "Stage 9-4 should keep the sparkline lightweight without a chart dependency"
);

for (const token of [
  "getBodyMeasurements",
  "getBodyMeasurementSeries",
  "measurementSeries",
  "measurementSettings.primaryMetric",
  "<BodyMeasurementSummaryCard",
  'pathname: "/photo/[id]"',
  'measurement: "1"'
]) {
  assert.ok(detail.includes(token), `project detail measurement chart should contain ${token}`);
}

assert.ok(
  detail.indexOf("<BodyMeasurementSummaryCard") <
    detail.indexOf("<View style={styles.statGrid}>"),
  "measurement summary should appear above the existing project stat cards"
);

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.dependencies?.["react-native-svg"],
  undefined,
  "Stage 9-4 should not add react-native-svg when a small View-based sparkline is sufficient"
);

console.log("Body Frame Stage 9-4 measurement sparkline contract passed.");
