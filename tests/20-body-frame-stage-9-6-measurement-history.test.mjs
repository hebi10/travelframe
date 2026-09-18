import assert from "node:assert/strict";
import fs from "node:fs";

const routeSource = fs.readFileSync(
  "app/project/[id]/measurements.tsx",
  "utf8"
);
const historySource = fs.readFileSync(
  "features/records/BodyMeasurementHistoryScreen.tsx",
  "utf8"
);
const projectDetailSource = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);
const summaryCardSource = fs.readFileSync(
  "components/body-measurement-summary-card.tsx",
  "utf8"
);

assert.ok(
  routeSource.includes("BodyMeasurementHistoryScreen"),
  "measurement history route should render the Body Frame history screen"
);

for (const token of [
  "getBodyMeasurements",
  "getBodyMeasurementSettings",
  "getBodyMeasurementSeries",
  "getBodyMeasurementSeriesSummary",
  "getBodyMeasurementMetricValue",
  "BodyMeasurementSummaryCard",
  "BodyMeasurementEditorSheet",
  "selectedMetric",
  "enabledMetrics",
  "OverviewStat",
  'label="시작"',
  'label="현재"',
  'label="변화"',
  'label="기록"',
  "기록 목록",
  "사진과 연결되지 않은 기록",
  "현재 기기에만 저장됩니다.",
  'router.push(("/photo/" + entry.photoId) as Href)'
]) {
  assert.ok(
    historySource.includes(token),
    `measurement history should contain ${token}`
  );
}

for (const metric of ["weight", "bodyFat", "skeletalMuscle", "waist"]) {
  assert.ok(
    historySource.includes("bodyMeasurementMetricMeta") ||
      historySource.includes(metric),
    "measurement history should use the shared metric metadata"
  );
}

assert.ok(
  historySource.includes("openNewEntry") &&
    historySource.includes("openEntry(entry)") &&
    historySource.includes("onDeleted") &&
    historySource.includes("void reload()"),
  "measurement history should support add/edit/delete and refresh"
);

assert.equal(
  historySource.includes("firestore") ||
    historySource.includes("Health Connect") ||
    historySource.includes("health_connect"),
  false,
  "Stage 9-6 should remain Local Only and must not add cloud or Health Connect access"
);

assert.ok(
  projectDetailSource.includes('pathname: "/project/[id]/measurements"') &&
    projectDetailSource.includes("onOpenHistory"),
  "project detail should link the mini measurement card to the full history screen"
);

assert.ok(
  summaryCardSource.includes("onOpenHistory") &&
    summaryCardSource.includes("전체 보기") &&
    summaryCardSource.includes("bodyFrameDesign.minTouchSize"),
  "measurement summary card should expose an accessible history entry point"
);

for (const forbidden of [
  "borderTopWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRightWidth"
]) {
  assert.equal(
    historySource.includes(forbidden),
    false,
    `measurement history should not use one-sided borders: ${forbidden}`
  );
}

console.log("Body Frame Stage 9-6 measurement history contract passed.");
