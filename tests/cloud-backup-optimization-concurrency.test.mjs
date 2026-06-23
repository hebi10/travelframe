import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/cloud-backup.ts", "utf8");

for (const snippet of [
  "BACKUP_IMAGE_OPTIMIZATION_CONCURRENCY",
  "mapWithConcurrencyLimit",
  "cleanupOptimizedBackupImage",
  "cleanupOptimizedBackupImages",
  "FileSystem.deleteAsync"
]) {
  assert.ok(source.includes(snippet), `cloud backup should bound and clean optimized images: ${snippet}`);
}

assert.equal(
  source.includes("const optimizedPhotos = (await Promise.all("),
  false,
  "full backup photo optimization should not fan out all images with Promise.all"
);
assert.equal(
  source.includes("const optimizedImageBundles = (await Promise.all("),
  false,
  "full backup image bundle optimization should not fan out all works with Promise.all"
);

assert.ok(
  source.includes("await cleanupOptimizedBackupImages(optimizedImagesForCleanup);"),
  "cloud backup should clean optimized temp images after uploads or failures"
);

assert.ok(
  source.includes("await cleanupOptimizedBackupImage({ optimized, sourceUri: photo.uri });"),
  "single photo backup should clean its optimized temp image"
);

const backupImageBundleStart = source.indexOf("export const backupImageBundleWork");
const backupMadeVideoStart = source.indexOf("export const backupMadeVideo");
assert.ok(
  backupImageBundleStart >= 0 && backupMadeVideoStart > backupImageBundleStart,
  "single image bundle backup function should exist"
);
const backupImageBundleSource = source.slice(backupImageBundleStart, backupMadeVideoStart);
assert.equal(
  backupImageBundleSource.includes("const optimizedImages = await Promise.all("),
  false,
  "single image bundle backup optimization should also use bounded concurrency"
);
assert.ok(
  backupImageBundleSource.includes("await cleanupOptimizedBackupImages(optimizedImagesForCleanup);"),
  "single image bundle backup should clean optimized temp images"
);

console.log("ok - cloud backup limits image optimization concurrency and cleans temp files");
