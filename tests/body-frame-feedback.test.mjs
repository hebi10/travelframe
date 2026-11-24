import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const importPureModule = (file) => {
  const input = fs.readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  });
  return import(`data:text/javascript,${encodeURIComponent(outputText)}`);
};

const { getExifPhotoCapturedAt } = await importPureModule("photo-capture-date");
const { findHealthConnectPhoto, groupBodyHealthConnectMeasurements, indexHealthConnectMeasurements } = await importPureModule("body-health-connect-import");
const { normalizeBodyFrameVideoOptions } = await importPureModule("body-frame-video");
const camera = await importPureModule("body-frame-camera-session");

test("EXIF uses the original date and offset and rejects invalid dates", () => {
  assert.equal(getExifPhotoCapturedAt({ DateTimeOriginal: "2024:02:29 23:00:01", OffsetTimeOriginal: "-05:00" }),
    "2024-03-01T04:00:01.000Z");
  const previousZone = process.env.TZ;
  try {
    process.env.TZ = "Asia/Seoul";
    assert.equal(getExifPhotoCapturedAt({ DateTime: "2024:02:29 23:00:01" }), "2024-02-29T14:00:01.000Z");
    process.env.TZ = "America/New_York";
    assert.equal(getExifPhotoCapturedAt({ DateTime: "2024:02:29 23:00:01" }), "2024-03-01T04:00:01.000Z");
    assert.equal(getExifPhotoCapturedAt({ DateTime: "2024:03:10 02:30:00" }), undefined);
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
  assert.equal(getExifPhotoCapturedAt({ DateTimeOriginal: "2025:02:29 23:00:01" }), undefined);
  assert.equal(getExifPhotoCapturedAt({}), undefined);
});

test("Health Connect combines matching instants and picks the closest unused photo on the same day", () => {
  const candidates = [
    { metric: "weight", value: 72.5, recordedAt: "2026-11-20T21:00:00Z", sourceRecordId: "weight", sourceAppPackage: "source" },
    { metric: "bodyFat", value: 18.1, recordedAt: "2026-11-21T06:00:00+09:00", sourceRecordId: "fat", sourceAppPackage: "source" },
    { metric: "bodyFat", value: 19, recordedAt: "2026-11-21T06:00:00+09:00", sourceRecordId: "other-fat", sourceAppPackage: "another" }
  ];
  const groups = groupBodyHealthConnectMeasurements(candidates);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].originalRecordIds, ["weight", "fat"]);
  assert.equal(groups[0].weightKg, 72.5);
  assert.equal(groups[0].bodyFatPercent, 18.1);
  const photos = [
    { id: "previous-day", createdAt: "2026-11-20T14:59:00Z" },
    { id: "near", createdAt: "2026-11-20T21:05:00Z" },
    { id: "later", createdAt: "2026-11-20T23:00:00Z" }
  ];
  assert.equal(findHealthConnectPhoto(groups[0].recordedAt, photos, new Set(["near"]), "Asia/Seoul").id, "later");
  assert.equal(findHealthConnectPhoto(groups[0].recordedAt, photos, new Set(["near", "later"]), "Asia/Seoul"), undefined);
  assert.equal(findHealthConnectPhoto(groups[0].recordedAt, photos, new Set(["near", "later"]), "America/Los_Angeles").id, "previous-day");
});

test("Health Connect matches the closest complementary measurement within one minute from the same source", () => {
  const candidate = (metric, seconds, id, sourceAppPackage = "source") => ({
    metric, value: metric === "weight" ? 72 : 18,
    recordedAt: new Date(Date.UTC(2026, 10, 20, 21, 0, seconds)).toISOString(),
    sourceRecordId: id, sourceAppPackage
  });
  const groups = groupBodyHealthConnectMeasurements([
    candidate("weight", 0, "earlier"),
    candidate("weight", 37, "nearest"),
    candidate("bodyFat", 38, "paired"),
    candidate("bodyFat", 37, "other-source", "other"),
    candidate("bodyFat", 120, "too-late")
  ]);
  assert.deepEqual(groups.find((group) => group.originalRecordIds.includes("paired")).originalRecordIds, ["nearest", "paired"]);
  assert.equal(groups.length, 4);
});

test("Health Connect finds the same pair when only one previously imported metric is enabled", () => {
  const weight = { metric: "weight", value: 72, recordedAt: "2026-11-20T21:00:00Z", sourceRecordId: "weight-id", sourceAppPackage: "source" };
  const fat = { metric: "bodyFat", value: 18, recordedAt: "2026-11-20T21:00:30Z", sourceRecordId: "fat-id", sourceAppPackage: "source" };
  const [pair] = groupBodyHealthConnectMeasurements([weight, fat]);
  const saved = {
    id: "saved-pair", source: "health_connect", sourceRecordId: pair.sourceRecordId,
    sourceMemberIds: pair.originalRecordIds
  };
  const [updated] = groupBodyHealthConnectMeasurements([fat], [saved]);
  assert.notEqual(updated.sourceRecordId, saved.sourceRecordId);
  assert.equal(indexHealthConnectMeasurements([saved]).get(updated.originalRecordIds[0]), saved);
  const nearby = { ...weight, sourceRecordId: "new-weight", recordedAt: "2026-11-20T21:00:29Z" };
  assert.equal(groupBodyHealthConnectMeasurements([nearby, fat], [saved]).length, 2);
});

test("saved Body Frame settings round-trip with music and all overlay properties", () => {
  const options = {
    interval: 0.2, quality: 1080, ratio: "9:16", musicTrackId: "track-a",
    overlay: { showDate: true, showWeight: false, showBodyFat: true, customText: "12주차", position: "top-left" }
  };
  assert.deepEqual(normalizeBodyFrameVideoOptions(JSON.parse(JSON.stringify(options))), options);
  assert.equal(normalizeBodyFrameVideoOptions(undefined), undefined);
  assert.equal(normalizeBodyFrameVideoOptions({ interval: 123 }).interval, 0.1);
});

test("releasing a failed capture and deleting the latest photo make its display number reusable", () => {
  camera.setBodyFrameCameraSession({ projectId: "feedback", sequence: 5, projectPhotoCount: 4 });
  const capture = camera.reserveBodyFrameCameraCapture();
  camera.finishBodyFrameCameraCapture({ ...capture, success: false });
  const retry = camera.reserveBodyFrameCameraCapture();
  assert.equal(retry.sequence, 5);
  camera.finishBodyFrameCameraCapture({ ...retry, success: true });
  camera.setBodyFrameCameraSession({ projectId: "feedback", sequence: 5, projectPhotoCount: 4 });
  assert.equal(camera.getBodyFrameCameraSessionSnapshot().sequence, 6);
  camera.resetBodyFrameCameraSequence("feedback", 5);
  assert.equal(camera.reserveBodyFrameCameraCapture().sequence, 5);
});
