import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");

assert.ok(
  cameraSource.includes('orientationSource="interface"'),
  "camera output orientation should follow the locked portrait interface, not physical device rotation"
);

const normalizeStart = photoLibrarySource.indexOf("const normalizeCapturedPhotoForRatio = async");
const normalizeEnd = photoLibrarySource.indexOf("const renderCapturedPhotoForSave = async");
assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart, "captured photo normalizer should exist");

const normalizeSource = photoLibrarySource.slice(normalizeStart, normalizeEnd);

assert.ok(
  normalizeSource.includes("const normalized = await manipulateAsync(uri, [],"),
  "captured photo normalizer should bake EXIF orientation into a stable JPEG before ratio crop"
);

assert.ok(
  !normalizeSource.includes("if (dimensions?.width && dimensions.height)"),
  "captured photo normalizer should not skip EXIF normalization when dimensions are already available"
);

const renderStart = photoLibrarySource.indexOf("const renderCapturedPhotoForSave = async");
const renderEnd = photoLibrarySource.indexOf("const deleteTemporaryFiles = async");
assert.ok(renderStart >= 0 && renderEnd > renderStart, "captured photo render pipeline should exist");

const renderSource = photoLibrarySource.slice(renderStart, renderEnd);

assert.ok(
  renderSource.includes("const normalizedSource = await normalizeCapturedPhotoForRatio({") &&
    renderSource.indexOf("const normalizedSource = await normalizeCapturedPhotoForRatio({") <
      renderSource.indexOf("if (shouldApplyRatio)"),
  "captured photo save should normalize EXIF orientation before both Original and preset-ratio saves"
);

assert.ok(
  renderSource.includes("uri: normalizedSource.uri") &&
    renderSource.includes("temporaryUris: normalizedSource.temporaryUris"),
  "Original camera saves should use the normalized source file and clean up temporary files"
);

console.log("ok - landscape physical captures keep stable portrait-oriented ratio saves");
