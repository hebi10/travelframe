import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/cloud-backup.ts", "utf8");

const refreshStart = source.indexOf("const refreshBackupOverview = async");
const refreshEnd = source.indexOf("export const subscribeCloudBackupOverview", refreshStart);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, "refreshBackupOverview should exist");

const refreshSource = source.slice(refreshStart, refreshEnd);

for (const snippet of [
  "backedUpAt?: string",
  "...(backedUpAt ? { backedUpAt } : {})"
]) {
  assert.ok(
    refreshSource.includes(snippet),
    `backup overview refresh should preserve latest single-item backup time: ${snippet}`
  );
}

for (const snippet of [
  "await refreshBackupOverview(user.uid, backedUpAt);"
]) {
  assert.ok(
    source.includes(snippet),
    `single-item backup should refresh account summary timestamp: ${snippet}`
  );
}

console.log("ok - single-item backups refresh account summary timestamp");
