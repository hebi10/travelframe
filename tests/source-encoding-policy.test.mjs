import assert from "node:assert/strict";
import fs from "node:fs";

const sourceFiles = [
  "features/camera/CameraScreen.tsx",
  "lib/app-settings.ts",
  "app.json",
  "README.md",
  "AGENTS.md"
];

for (const filePath of sourceFiles) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    false,
    `${filePath} should be UTF-8 without BOM`
  );
}

console.log("ok - source files use UTF-8 without BOM");
