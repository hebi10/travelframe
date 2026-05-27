import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/trip-clip-export.ts", "utf8");
const fallbackSection = source.slice(
  source.indexOf("const saveImageToAndroidDownload"),
  source.indexOf("const saveImageToAndroidAlbum")
);

assert.ok(
  fallbackSection.includes("const targetUri = await FileSystem.StorageAccessFramework.createFileAsync"),
  "Android SAF fallback should create the destination file"
);
assert.ok(
  fallbackSection.includes("writeAsStringAsync(targetUri"),
  "Android SAF fallback should write to the destination file"
);
assert.ok(
  fallbackSection.includes("return targetUri;"),
  "Android SAF fallback should return the actual saved destination URI"
);
assert.equal(
  fallbackSection.includes("return saveUri;"),
  false,
  "Android SAF fallback should not persist the temporary render URI as the saved work URI"
);

console.log("ok - Android SAF fallback returns the saved image URI");
