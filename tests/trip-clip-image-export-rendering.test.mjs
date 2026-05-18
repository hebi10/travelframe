import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const imageExportSourceUrl = new URL("../lib/trip-clip-image-export.ts", import.meta.url);
const exportSourceUrl = new URL("../lib/trip-clip-export.ts", import.meta.url);
const tripClipSourceUrl = new URL("../app/trip-clip.tsx", import.meta.url);
const imageExportSource = fs.readFileSync(imageExportSourceUrl, "utf8");
const exportSource = fs.readFileSync(exportSourceUrl, "utf8");
const tripClipSource = fs.readFileSync(tripClipSourceUrl, "utf8");
const transpiled = ts.transpileModule(imageExportSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const { getTripClipImageExportActions } = await import(
  `data:text/javascript,${encodeURIComponent(transpiled)}`
);

const centeredCrop = getTripClipImageExportActions({
  width: 4000,
  height: 3000,
  frameAspectRatio: 9 / 16,
  adjustment: {
    translateX: 0,
    translateY: 0,
    scale: 1
  },
  frameWidth: 360,
  frameHeight: 640
});

assert.deepEqual(centeredCrop, [
  {
    crop: {
      originX: 1156,
      originY: 0,
      width: 1688,
      height: 3000
    }
  }
]);

const zoomedAndDraggedCrop = getTripClipImageExportActions({
  width: 4000,
  height: 3000,
  frameAspectRatio: 9 / 16,
  adjustment: {
    translateX: 36,
    translateY: -48,
    scale: 2
  },
  frameWidth: 360,
  frameHeight: 640
});

assert.deepEqual(zoomedAndDraggedCrop, [
  {
    crop: {
      originX: 1494,
      originY: 863,
      width: 844,
      height: 1500
    }
  }
]);

for (const snippet of [
  "frameAspectRatio: ratioAspect[ratio]",
  "adjustment: getTripClipPhotoAdjustment(photoAdjustments, photo.id)",
  "frameWidth: previewFrameSize.width",
  "const savedImageUri = await saveImageToLibrary(photo.uri, imageSaveFormat, {",
  "savedImageUris.push(savedImageUri)"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip export rendering wiring missing: ${snippet}`);
}

for (const snippet of [
  "TRIP_CLIP_ANDROID_DOWNLOAD_FOLDER",
  "StorageAccessFramework.makeDirectoryAsync(",
  "androidDownloadDirectoryUri = exportDirectoryUri"
]) {
  assert.ok(exportSource.includes(snippet), `android export folder handling missing: ${snippet}`);
}

console.log("ok - trip clip image export applies ratio, adjustments, and app folder");
