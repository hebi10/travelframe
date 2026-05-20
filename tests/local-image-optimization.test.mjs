import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const photoLibrarySource = readFileSync("lib/photo-library.ts", "utf8");
const backupSource = readFileSync("lib/cloud-backup.ts", "utf8");

for (const snippet of [
  "optimizeImageForStorage",
  "prepareCapturedPhotoForStorage",
  "prepareEditedPhotoForStorage",
  "imageBackupQuality",
  'const extension = "jpg"',
  "imageQuality: prepared.imageQuality",
  "optimizedQuality: prepared.quality",
  "optimizedSize: prepared.size"
]) {
  assert.ok(
    photoLibrarySource.includes(snippet),
    `photo library should optimize locally saved images: ${snippet}`
  );
}

assert.ok(
  photoLibrarySource.indexOf("const prepared = await prepareCapturedPhotoForStorage({") <
    photoLibrarySource.indexOf("from: prepared.uri"),
  "captured photos should be optimized before app storage copy"
);

assert.ok(
  photoLibrarySource.includes("saveCapturedPhotoToDevice") &&
    photoLibrarySource.includes("await prepareCapturedPhotoForStorage(input)"),
  "direct camera saves should use the same storage optimization path"
);

assert.ok(
  backupSource.includes("width: work.imageWidths?.[index] ?? null") &&
    backupSource.includes("height: work.imageHeights?.[index] ?? null") &&
    backupSource.includes("sourceImageQuality: work.imageQuality ?? null"),
  "image bundle backup should pass known exported dimensions into optimization"
);

console.log("ok - local images and image bundles use shared optimization policy");
