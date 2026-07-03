import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const backupWorkspace = source.slice(
  source.indexOf("export const backupCurrentWorkspace"),
  source.indexOf("export const backupPhoto")
);

assert.match(
  backupWorkspace,
  /const overview = await refreshBackupOverview\(user\.uid, backedUpAt\);/,
  "workspace backup should refresh the lightweight overview"
);
assert.doesNotMatch(
  backupWorkspace,
  /doc\(firestore, "users", user\.uid, "backups", "current"\)[\s\S]*?settings[\s\S]*?imageBundles[\s\S]*?videos/,
  "workspace backup should not write full settings or item arrays into backups/current"
);

console.log("ok - cloud backup overview stays lightweight");
