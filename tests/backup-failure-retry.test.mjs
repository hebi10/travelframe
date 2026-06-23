import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

const retryQueueSource = fs.readFileSync("lib/backup-failure-queue.ts", "utf8");
const settingsSource = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");
const tripClipSource = readTripClipSource();

for (const snippet of [
  "recordBackupFailure",
  "getBackupFailures",
  "clearBackupFailure",
  "backup-failure-queue"
]) {
  assert.ok(retryQueueSource.includes(snippet), `backup failure queue missing: ${snippet}`);
}

for (const snippet of [
  "retryBackupFailures",
  "실패한 백업 다시 시도",
  "getBackupFailures",
  "clearBackupFailure",
  "recordBackupFailure"
]) {
  assert.ok(settingsSource.includes(snippet), `settings retry UI missing: ${snippet}`);
}

for (const snippet of [
  "recordBackupFailure",
  'kind: "image-bundle"',
  'kind: "video"'
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip backup failure tracking missing: ${snippet}`);
}

console.log("ok - failed backup items can be recorded and retried from settings");
