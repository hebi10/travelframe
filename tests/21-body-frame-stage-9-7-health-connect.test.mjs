import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const appJson = JSON.parse(fs.readFileSync("app.json", "utf8"));
const healthConnectSource = fs.readFileSync("lib/body-health-connect.ts", "utf8");
const importCardSource = fs.readFileSync(
  "components/body-health-connect-import-card.tsx",
  "utf8"
);
const historySource = fs.readFileSync(
  "features/records/BodyMeasurementHistoryScreen.tsx",
  "utf8"
);
const editorSource = fs.readFileSync(
  "features/records/BodyMeasurementEditorSheet.tsx",
  "utf8"
);
const measurementTypeSource = fs.readFileSync(
  "types/body-measurement.ts",
  "utf8"
);
const measurementLibrarySource = fs.readFileSync(
  "lib/body-measurement-library.ts",
  "utf8"
);
const normalizationSource = fs.readFileSync(
  "lib/body-measurement-normalization.ts",
  "utf8"
);
const cloudBackupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const pluginSource = fs.readFileSync(
  "plugins/with-android-release-manifest.js",
  "utf8"
);
const privacyMarkdown = fs.readFileSync("privacy/privacy-policy.md", "utf8");
const publicPrivacy = fs.readFileSync("privacy/index.html", "utf8");
const adminPrivacy = fs.readFileSync("admin/privacy/index.html", "utf8");
const dataSafety = fs.readFileSync(
  "privacy/play-console-data-safety.md",
  "utf8"
);
const manualQa = fs.readFileSync("docs/manual-device-qa.md", "utf8");

assert.equal(
  packageJson.dependencies["react-native-health-connect"],
  "4.1.3",
  "Health Connect dependency should stay pinned"
);
assert.equal(
  packageLock.packages[""].dependencies["react-native-health-connect"],
  "4.1.3",
  "package lock root should include Health Connect"
);
assert.equal(
  packageLock.packages["node_modules/react-native-health-connect"]?.version,
  "4.1.3",
  "package lock should include Health Connect package metadata"
);

assert.ok(
  appJson.expo.plugins.includes("react-native-health-connect"),
  "Expo config should run the Health Connect plugin"
);
for (const permission of [
  "android.permission.health.READ_WEIGHT",
  "android.permission.health.READ_BODY_FAT"
]) {
  assert.ok(
    appJson.expo.android.permissions.includes(permission),
    `Android config should request ${permission}`
  );
}
for (const forbidden of [
  "android.permission.health.WRITE_WEIGHT",
  "android.permission.health.WRITE_BODY_FAT",
  "android.permission.health.READ_HEALTH_DATA_HISTORY",
  "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
]) {
  assert.equal(
    appJson.expo.android.permissions.includes(forbidden),
    false,
    `Stage 9-7 should not request ${forbidden}`
  );
}

assert.ok(
  pluginSource.includes("withGradleProperties") &&
    pluginSource.includes('"android.minSdkVersion"') &&
    pluginSource.includes('"26"'),
  "generated Android project should require minSdk 26 for Health Connect"
);

for (const token of [
  'type BodyHealthConnectMetric = "weight" | "bodyFat"',
  'recordType: "Weight"',
  'recordType: "BodyFat"',
  "getSdkStatus",
  "initialize",
  "getGrantedPermissions",
  "requestPermission",
  "readRecords",
  "days = 30",
  "openHealthConnectSettings",
  "inKilograms",
  "record.percentage"
]) {
  assert.ok(
    healthConnectSource.includes(token),
    `Health Connect read service should contain ${token}`
  );
}
for (const forbidden of [
  "LeanBodyMass",
  "insertRecords",
  "BackgroundAccessPermission",
  "ReadHealthDataHistoryPermission",
  '"write"'
]) {
  assert.equal(
    healthConnectSource.includes(forbidden),
    false,
    `Health Connect read service should not use ${forbidden}`
  );
}

for (const token of [
  "BodyHealthConnectImportCard",
  "Health Connect 연결",
  "최신 기록 확인",
  "가져오기",
  "최근 30일",
  "getBodyMeasurementBySourceRecordId",
  'source: "health_connect"',
  "sourceRecordId",
  "Firebase에는 자동으로 업로드되지 않습니다.",
  "개인정보처리방침"
]) {
  assert.ok(
    importCardSource.includes(token),
    `Health Connect import card should contain ${token}`
  );
}

assert.ok(
  historySource.includes("BodyHealthConnectImportCard") &&
    historySource.includes('entry.source === "health_connect"') &&
    historySource.includes('" · Health Connect"'),
  "measurement history should expose opt-in Health Connect import and source labels"
);

for (const source of [
  measurementTypeSource,
  measurementLibrarySource,
  normalizationSource
]) {
  assert.ok(
    source.includes("sourceRecordId"),
    "measurement model should preserve the Health Connect source record id"
  );
}
assert.ok(
  measurementLibrarySource.includes("getBodyMeasurementBySourceRecordId"),
  "measurement storage should dedupe Health Connect imports"
);
assert.ok(
  editorSource.includes('source: entry?.source ?? "manual"') &&
    editorSource.includes("sourceRecordId: entry?.sourceRecordId") &&
    editorSource.includes("sourceAppPackage: entry?.sourceAppPackage"),
  "editing an imported measurement should preserve its provenance"
);

assert.equal(
  cloudBackupSource.includes("body-health-connect") ||
    cloudBackupSource.includes("sourceRecordId"),
  false,
  "Health Connect measurements should not be coupled to photo cloud backup"
);

for (const source of [privacyMarkdown, publicPrivacy, adminPrivacy]) {
  for (const token of [
    "Health Connect",
    "몸무게",
    "체지방률",
    "최근 30일",
    "자동 동기화",
    "Firebase",
    "광고"
  ]) {
    assert.ok(
      source.includes(token),
      `Health Connect privacy disclosure should contain ${token}`
    );
  }
}
for (const token of [
  "READ_WEIGHT",
  "READ_BODY_FAT",
  "Health apps",
  "자동 업로드하지 않음"
]) {
  assert.ok(
    dataSafety.includes(token),
    `Play Console data-safety guidance should contain ${token}`
  );
}

for (const token of [
  "Health Connect 카드는 사용자가 직접 연결할 때만",
  "몸무게와 체지방률 읽기 권한만",
  "최근 30일",
  "중복 수치 기록이 생성되지 않는다"
]) {
  assert.ok(
    manualQa.includes(token),
    `manual QA should cover Health Connect behavior: ${token}`
  );
}

console.log("Body Frame Stage 9-7 Health Connect contract passed.");
