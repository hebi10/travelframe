import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = (path) => ts.transpileModule(
  fs.readFileSync(path, "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;
const execute = (path, dependencies = {}) => {
  const exports = {};
  vm.runInNewContext(compile(path), {
    exports,
    require: name => {
      if (!(name in dependencies)) throw Error("Unexpected module " + name);
      return dependencies[name];
    }
  });
  return exports;
};

const values = new Map();
const adapter = {
  getItem: async key => values.get(key) ?? null,
  setItem: async (key, value) => values.set(key, value)
};
const types = execute("types/body-measurement.ts");
const normalizer = execute("lib/body-measurement-normalization.ts", {
  "@/types/body-measurement": types
});
const library = execute("lib/body-measurement-library.ts", {
  "@/lib/local-storage": { localStorageAdapter: adapter },
  "@/lib/body-measurement-normalization": normalizer,
  "@/lib/project-cloud-sync-queue": { enqueueProjectCloudSync: async () => {} },
  "@/types/body-measurement": types
});

const sample = {
  id: "measurement-1", projectId: "project-a", photoId: "photo-1",
  sequence: 1, recordedAt: "2026-11-18T06:00:00.000Z",
  weightKg: 70, bodyFatPercent: 17.1, note: "운동 기록", source: "manual"
};
const incoming = {
  ...sample, weightKg: 71
};
values.set(library.BODY_MEASUREMENT_STORAGE_KEY, JSON.stringify([sample]));
const unchanged = await library.mergeBodyMeasurementsFromBackup([incoming]);
assert.equal(unchanged.length, 0, "restore must not overwrite newer local measurement edits");
assert.equal((await library.getBodyMeasurements("project-a"))[0].weightKg, 70);

const photoTwin = {
  ...sample,
  id: "old-remote-id",
  weightKg: 68
};
assert.equal((await library.mergeBodyMeasurementsFromBackup([photoTwin])).length, 0,
  "manual measurements for the same project/photo must not duplicate across devices");

const health = {
  ...sample, id: "health-1", source: "health_connect", sourceRecordId: "health-item-1"
};
const healthTwin = { ...health, id: "health-remote-id" };
assert.equal((await library.mergeBodyMeasurementsFromBackup([health])).length, 1);
assert.equal((await library.mergeBodyMeasurementsFromBackup([healthTwin])).length, 0,
  "Health Connect source records must not duplicate on repeated restores");

const deleted = {
  ...sample, id: "to-delete", photoId: "photo-deleted", weightKg: 65
};
await library.saveBodyMeasurement(deleted);
await library.deleteBodyMeasurement(deleted.id);
assert.equal((await library.getBodyMeasurements("project-a")).some(x => x.id === deleted.id), false);
assert.equal((await library.mergeBodyMeasurementsFromBackup([deleted])).length, 0,
  "explicit local deletion must not be undone by a stale cloud backup");
const deletedIds = JSON.parse(values.get(library.DELETED_BODY_MEASUREMENTS_STORAGE_KEY));
assert.ok(deletedIds.includes(deleted.id), "deletion tombstone must survive app restart");

const restored = {
  ...sample, id: "remote-2", projectId: "project-b", photoId: "photo-2",
  sequence: 9, weightKg: 75.5
};
assert.equal((await library.mergeBodyMeasurementsFromBackup([restored])).length, 1);
assert.equal((await library.mergeBodyMeasurementsFromBackup([restored])).length, 0,
  "repeat restore must be idempotent");
assert.equal((await library.getBodyMeasurements("project-b"))[0].photoId, "photo-2");
assert.equal((await library.getBodyMeasurements("project-b"))[0].sequence, 9);

await library.updateBodyMeasurementSettings("project-a", {
  enabled: false, promptAfterCapture: false
});
const remoteSettings = {
  enabled: true, promptAfterCapture: true, primaryMetric: "bodyFat",
  fields: { weight: true, bodyFat: true, skeletalMuscle: false, waist: false }
};
await library.mergeBodyMeasurementSettingsFromBackup([
  { projectId: "project-a", settings: remoteSettings },
  { projectId: "project-b", settings: remoteSettings }
]);
assert.equal((await library.getBodyMeasurementSettings("project-a")).enabled, false,
  "local opt-out setting must win over remote settings");
assert.equal((await library.getBodyMeasurementSettings("project-b")).enabled, true,
  "missing settings on a fresh device should be restored");
assert.equal((await library.getBodyMeasurementSettings("project-b")).primaryMetric, "bodyFat");

const pose = execute("lib/body-pose-alignment.ts", {
  "@/lib/local-storage": { localStorageAdapter: adapter },
  "@/lib/project-cloud-sync-queue": { enqueueProjectCloudSync: async () => {} },
  "@/types/body-pose-alignment": execute("types/body-pose-alignment.ts")
});
await pose.updateBodyPoseAlignmentSettings("project-a", false);
await pose.mergeBodyPoseAlignmentSettingsFromBackup([
  { projectId: "project-a", enabled: true },
  { projectId: "project-b", enabled: true }
]);
assert.equal((await pose.getBodyPoseAlignmentSettings("project-a")).enabled, false);
assert.equal((await pose.getBodyPoseAlignmentSettings("project-b")).enabled, true);

const captureTypes = execute("types/body-capture-context.ts");
const defaultAppSettings = {
  cameraFacing: "back", cameraRatio: "9:16", cameraZoomPercent: 50,
  cameraExposureBias: 0, cameraColorTemperature: 0,
  cameraColorTint: 0, cameraBrightness: 0,
  cameraContrast: 0, cameraSaturation: 0
};
const context = execute("lib/body-frame-capture-context.ts", {
  "@/lib/project-cloud-sync-queue": { enqueueProjectCloudSync: async () => {} },
  "@/lib/app-settings": {
    defaultAppSettings,
    normalizeCameraZoomPercent: n => n
  },
  "@/lib/local-storage": { localStorageAdapter: adapter },
  "@/types/body-capture-context": captureTypes
});
await context.updateBodyCaptureContextEnabled("project-a", false);
await context.mergeBodyCaptureContextStatesFromBackup([
  { projectId: "project-a", state: { enabled: true, context: null } },
  { projectId: "project-b", state: { enabled: true, context: null } }
]);
assert.equal((await context.getBodyCaptureContextState("project-a")).enabled, false);
assert.equal((await context.getBodyCaptureContextState("project-b")).enabled, true);

const backup = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const server = fs.readFileSync("functions/index.js", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");
for (const fragment of [
  "backupBodyProjectSupplement(user.uid, projectId)",
  'doc(firestore, "users", userId, "bodyMeasurements", entry.id)',
  'doc(firestore, "users", userId, "bodyProjectSettings", projectId)',
  'getDocs(collection(firestore, "users", user.uid, "bodyMeasurements"))',
  'getDocs(collection(firestore, "users", user.uid, "bodyProjectSettings"))',
  "mergeBodyMeasurementsFromBackup(remoteMeasurements)",
  "selectCloudProjectRestoreItems({",
  "restoredProjectIds.has(entry.projectId)",
  "mergeBodyCaptureContextStatesFromBackup"
]) assert.ok(backup.includes(fragment), "cloud backup missing: " + fragment);
assert.ok(server.includes('userRef.collection("bodyMeasurements").where("projectId", "==", projectId).get()'));
assert.ok(server.includes('userRef.collection("bodyProjectSettings").doc(projectId)'));
assert.ok(server.includes('userRef.collection("bodyMeasurements").get()'));
assert.ok(server.includes('userRef.collection("bodyProjectSettings").get()'));
assert.ok(rules.includes("match /bodyMeasurements/{measurementId}"));
assert.ok(rules.includes("match /bodyProjectSettings/{projectId}"));
assert.ok(rules.includes('request.resource.data.weightKg <= 500'));
console.log("ok - TF-CLOUD-01 guarded measurement backup and idempotent project preferences restore");
