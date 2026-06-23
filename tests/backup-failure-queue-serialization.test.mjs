import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/backup-failure-queue.ts", "utf8");

for (const snippet of [
  "backupFailureMutationChain",
  "runBackupFailureMutation",
  "return runBackupFailureMutation(async () => {"
]) {
  assert.ok(source.includes(snippet), `backup failure queue writes should be serialized: ${snippet}`);
}

const recordStart = source.indexOf("export const recordBackupFailure");
const clearStart = source.indexOf("export const clearBackupFailure");
const clearAllStart = source.indexOf("export const clearBackupFailures");
assert.ok(recordStart >= 0 && clearStart > recordStart, "backup failure queue functions should exist");

const recordSource = source.slice(recordStart, clearStart);
const clearSource = source.slice(clearStart, clearAllStart);
const clearAllSource = source.slice(clearAllStart);

assert.ok(
  recordSource.includes("return runBackupFailureMutation(async () => {") &&
    clearSource.includes("return runBackupFailureMutation(async () => {") &&
    clearAllSource.includes("return runBackupFailureMutation(async () => {"),
  "record, clear, and clear-all should all use the same serialized mutation chain"
);

console.log("ok - backup failure queue serializes all updates");
