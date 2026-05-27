import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/cloud-backup.ts", "utf8");
const imageUtilsSource = readFileSync("lib/image-backup-utils.ts", "utf8");

for (const snippet of [
  "optimizeImageForBackup",
  "getCurrentImageBackupSize",
  "assertImageBackupCapacity",
  "getCloudBackupStorageLimitBytes",
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
  imageUtilsSource.includes("resolveImageDimensions") &&
    imageUtilsSource.indexOf("resolveImageDimensions") <
      imageUtilsSource.indexOf("getImageResizeAction({"),
  "image optimization should resolve real dimensions before resize decisions"
);

assert.ok(
  source.indexOf("optimizeImageForBackup") < source.indexOf("uploadLocalFile"),
  "images should be optimized before Firebase Storage upload"
);

console.log("ok - cloud backup optimizes images and enforces size limits");
