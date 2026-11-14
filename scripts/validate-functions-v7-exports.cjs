"use strict";

const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const requireFunctions = createRequire(resolve(__dirname, "../functions/index.js"));

const expected = [
  "verifyGooglePlayPurchase",
  "handleGooglePlayBillingNotification",
  "selectCloudBackupProject",
  "replaceCloudBackupProject",
  "reserveWeeklyVideoExport",
  "releaseWeeklyVideoExport",
  "completeWeeklyVideoExport",
  "reserveBackupUpload",
  "completeBackupUpload",
  "releaseBackupUpload",
  "completeImageWorkBackup",
  "reserveMusicUpload",
  "completeMusicUpload",
  "releaseMusicUpload",
  "getAdminBackupCapabilities",
  "replaceAdminCloudBackupProject",
  "setAdminProductSubscription",
  "reserveAdminBackupUpload",
  "completeAdminBackupUpload",
  "deleteUserBackupItem",
  "deleteAdminBackupItem",
  "setAdminBackupStatus",
  "deleteCloudBackupData",
  "deleteAdminCloudBackupData"
];

const temporaryProjectId = "travelframe-stage19-offline-fixture";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: temporaryProjectId,
  storageBucket: temporaryProjectId + ".appspot.com"
});
process.env.GCLOUD_PROJECT = temporaryProjectId;
process.env.FUNCTIONS_ENFORCE_APP_CHECK = "false";
process.env.FUNCTIONS_ENABLE_ADMIN_BACKUP_DELETION = "false";
process.env.FUNCTIONS_ENABLE_ADMIN_FULL_BACKUP_DELETION = "false";

const { getApps, deleteApp } = requireFunctions("firebase-admin/app");
const { FieldValue, Timestamp } = requireFunctions("firebase-admin/firestore");
const exportsMap = requireFunctions("./index.js");

for (const name of expected) {
  assert.equal(typeof exportsMap[name], "function", name + " is not registered as a callable/event function");
  assert.ok(exportsMap[name].__endpoint || exportsMap[name].__trigger,
    name + " has no discoverable trigger metadata");
}

const event = exportsMap.handleGooglePlayBillingNotification;
assert.ok(event.__endpoint?.eventTrigger || event.__trigger?.eventTrigger,
  "Google Play RTDN Pub/Sub trigger was not registered");

assert.equal(typeof FieldValue.serverTimestamp, "function");
assert.equal(typeof FieldValue.delete, "function");
assert.equal(typeof Timestamp.fromMillis, "function");
assert.equal(getApps().length, 1, "Server must initialize exactly one isolated test app");
assert.equal(getApps()[0].options.projectId, temporaryProjectId);

console.log("Functions 7 offline registration: " + expected.length + " endpoints, RTDN trigger, modular Admin 14 OK");
void Promise.all(getApps().map(deleteApp)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
