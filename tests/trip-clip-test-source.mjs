import fs from "node:fs";

const tripClipSourceFiles = [
  "features/trip-clip/TripClipScreen.tsx",
  "features/trip-clip/components/TripClipHeader.tsx",
  "features/trip-clip/components/TripClipPreview.tsx",
  "features/trip-clip/components/TripClipPhotoTab.tsx",
  "features/trip-clip/components/TripClipTimelineTab.tsx",
  "features/trip-clip/components/TripClipVideoTab.tsx",
  "features/trip-clip/components/TripClipGuideTab.tsx",
  "features/trip-clip/components/TripClipMusicTab.tsx",
  "features/trip-clip/components/TripClipExportTab.tsx",
  "features/trip-clip/hooks/useTripClipPhotos.ts",
  "features/trip-clip/hooks/useTripClipPlayback.ts",
  "features/trip-clip/hooks/useTripClipMusic.ts",
  "features/trip-clip/trip-clip-screen.components.tsx",
  "features/trip-clip/trip-clip-screen.constants.ts",
  "features/trip-clip/trip-clip-screen.helpers.ts"
];

export function readTripClipSource() {
  return tripClipSourceFiles.map((path) => fs.readFileSync(path, "utf8")).join("\n");
}
