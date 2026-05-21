import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const lineCount = (path) => read(path).split(/\r?\n/).length;

const expectedFeatureFiles = [
  "features/account/account-screen.components.tsx",
  "features/account/account-screen.constants.ts",
  "features/account/account-screen.helpers.ts",
  "features/account/account-screen.styles.ts",
  "features/camera/camera-screen.components.tsx",
  "features/camera/camera-screen.constants.ts",
  "features/camera/camera-screen.helpers.ts",
  "features/camera/camera-screen.styles.ts",
  "features/settings/settings-screen.components.tsx",
  "features/settings/settings-screen.constants.ts",
  "features/settings/settings-screen.helpers.ts",
  "features/settings/settings-screen.styles.ts",
  "features/trip-clip/trip-clip-screen.components.tsx",
  "features/trip-clip/trip-clip-screen.constants.ts",
  "features/trip-clip/trip-clip-screen.helpers.ts",
  "features/trip-clip/trip-clip-screen.styles.ts"
];

for (const path of expectedFeatureFiles) {
  assert.ok(fs.existsSync(path), `screen refactor feature file missing: ${path}`);
}

const screenBoundaries = [
  ["app/(tabs)/account.tsx", "@/features/account/", 1250],
  ["app/(tabs)/camera.tsx", "@/features/camera/", 2600],
  ["app/(tabs)/settings.tsx", "@/features/settings/", 2300],
  ["app/(tabs)/trip-clip.tsx", "@/features/trip-clip/", 3200]
];

for (const [path, importPrefix, maxLines] of screenBoundaries) {
  const source = read(path);
  assert.ok(source.includes(importPrefix), `${path} should import focused feature modules`);
  assert.ok(
    lineCount(path) <= maxLines,
    `${path} should stay under ${maxLines} lines after refactor`
  );
}

console.log("ok - large screens are split into focused feature modules");
