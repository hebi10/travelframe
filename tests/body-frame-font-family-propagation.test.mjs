import assert from "node:assert/strict";
import fs from "node:fs";

const appTextSource = fs.readFileSync("components/app-text.tsx", "utf8");

for (const snippet of [
  "AppText",
  "AppTextInput",
  "useAppAppearance",
  "fontFamily",
  'settings.fontStyle === "noto_sans_kr"',
  'fontWeight: "400" as const'
]) {
  assert.ok(appTextSource.includes(snippet), `shared app typography missing: ${snippet}`);
}

const primaryBodyFrameFiles = [
  "components/section-block.tsx",
  "components/body-measurement-summary-card.tsx",
  "components/body-health-connect-import-card.tsx",
  "features/camera/CameraScreen.tsx",
  "features/camera/camera-screen.components.tsx",
  "features/camera/BodyFrameCameraScreen.tsx",
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "features/records/BodyFrameRecordsScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/records/BodyMeasurementEditorSheet.tsx",
  "features/records/BodyMeasurementHistoryScreen.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx",
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "features/trip-clip/BodyFrameVideoLibraryScreen.tsx",
  "features/trip-clip/BodyFrameVideoOptionsSheet.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "app/photo/[id].tsx",
  "app/capture-preview.tsx",
  "app/video/[id].tsx"
];

for (const file of primaryBodyFrameFiles) {
  const source = fs.readFileSync(file, "utf8");
  assert.ok(
    source.includes('from "@/components/app-text";'),
    `selected font should propagate through primary Body Frame UI: ${file}`
  );
}

console.log("ok - selected font propagates through primary Body Frame screens");
