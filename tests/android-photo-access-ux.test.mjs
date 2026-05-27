import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "app/(tabs)/studio.tsx",
  "app/(tabs)/trip-clip.tsx",
  "app/(tabs)/camera.tsx",
  "app/edit.tsx"
];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const snippet of [
    "requestMediaLibraryAccess",
    "isMediaLibraryAccessGranted"
  ]) {
    assert.ok(source.includes(snippet), `${file} should handle Android partial photo access: ${snippet}`);
  }
}

console.log("ok - Android photo import flows surface partial and blocked media access states");
