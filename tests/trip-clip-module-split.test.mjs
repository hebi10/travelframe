import assert from "node:assert/strict";
import fs from "node:fs";

const routeSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");

const expectedFiles = [
  "features/trip-clip/TripClipScreen.tsx",
  "features/trip-clip/hooks/useTripClipPhotos.ts",
  "features/trip-clip/hooks/useTripClipDraft.ts",
  "features/trip-clip/hooks/useTripClipPlayback.ts",
  "features/trip-clip/hooks/useTripClipGuide.ts",
  "features/trip-clip/hooks/useTripClipExport.ts",
  "features/trip-clip/hooks/useTripClipMusic.ts",
  "features/trip-clip/components/TripClipHeader.tsx",
  "features/trip-clip/components/TripClipPreview.tsx",
  "features/trip-clip/components/TripClipPhotoTab.tsx",
  "features/trip-clip/components/TripClipTimelineTab.tsx",
  "features/trip-clip/components/TripClipVideoTab.tsx",
  "features/trip-clip/components/TripClipGuideTab.tsx",
  "features/trip-clip/components/TripClipMusicTab.tsx",
  "features/trip-clip/components/TripClipExportTab.tsx"
];

for (const path of expectedFiles) {
  assert.ok(fs.existsSync(path), `trip clip split file should exist: ${path}`);
}

assert.ok(
  routeSource.includes('import TripClipScreen from "@/features/trip-clip/TripClipScreen"'),
  "route should delegate to the feature TripClipScreen"
);

assert.ok(
  routeSource.split(/\r?\n/).length <= 25,
  "trip clip route should stay as a thin Expo Router wrapper"
);

console.log("ok - trip clip screen is split into focused hooks and tab components");
