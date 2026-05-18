import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/cloud-backup.ts", "utf8");

for (const snippet of [
  "optimizeImageForBackup",
  "getCurrentImageBackupSize",
  "assertImageBackupCapacity",
  "MAX_TOTAL_IMAGE_BACKUP_SIZE_BYTES",
  "IMAGE_BACKUP_SIZE_EXCEEDED_MESSAGE",
  "IMAGE_OPTIMIZATION_FAILED_MESSAGE",
  "imageBackupBytes",
  "optimizedImages",
  "originalSize",
  "optimizedSize",
  "imageQuality"
]) {
  assert.ok(source.includes(snippet), `cloud backup image optimization missing: ${snippet}`);
}

assert.ok(
  source.indexOf("optimizeImageForBackup") < source.indexOf("uploadLocalFile"),
  "images should be optimized before Firebase Storage upload"
);

console.log("ok - cloud backup optimizes images and enforces size limits");
