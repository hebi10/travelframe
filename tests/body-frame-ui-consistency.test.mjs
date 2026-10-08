import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const theme = read("constants/app-theme.ts");
const appText = read("components/app-text.tsx");
const shell = read("components/screen-shell.tsx");
const tabs = read("app/(tabs)/_layout.tsx");
const routes = read("app/_layout.tsx");
const videoDetail = read("app/video/[id].tsx");
const editRoute = read("app/legacy-video-edit.tsx");
const records = read("features/records/BodyFrameRecordsScreen.tsx");
const videoCreate = read("features/trip-clip/BodyFrameVideoScreen.tsx");
const videoSettings = read("features/trip-clip/BodyFrameVideoOptionsSheet.tsx");
const settings = read("features/settings/BodyFrameSettingsScreen.tsx");
const projectSwitcher = read("features/camera/BodyFrameProjectSwitcher.tsx");
const adminCss = read("admin/styles.css");

const colorComponent = (hex) => {
  const normalized = hex / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) =>
    colorComponent(parseInt(value.slice(offset, offset + 2), 16))
  );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (first, second) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

const darkTheme = theme.slice(theme.indexOf("export const bodyFrameDarkColors"));
const darkColor = (key) => {
  const match = darkTheme.match(new RegExp('\\b' + key + ': "(#[0-9a-fA-F]{6})"'));
  assert.ok(match, `missing dark ${key} token`);
  return match[1];
};
assert.ok(
  contrast(darkColor("faint"), darkColor("surface")) >= 4.5,
  "dark faint text should have >= 4.5:1 contrast against cards"
);
assert.ok(
  contrast(darkColor("faint"), darkColor("background")) >= 4.5,
  "dark faint text should have >= 4.5:1 contrast against background"
);

assert.ok(appText.includes("StyleSheet.flatten(style)"));
assert.ok(appText.includes("fontSizeScale"));
assert.ok(appText.includes("resolvedStyle.lineHeight * fontSizeScale"));
assert.ok(shell.includes("bodyFrameTypography.pageTitle"));
assert.ok(shell.includes("bodyFrameDesign.contentMaxWidth"));
assert.ok(tabs.includes("bodyFrameDesign.contentMaxWidth"));

assert.ok(routes.includes('name="legacy-video-edit"'));
assert.ok(editRoute.includes("TripClipScreen"));
assert.ok(videoDetail.includes('pathname: "/legacy-video-edit"'));
assert.ok(videoDetail.includes('router.replace("/video-library"'));
assert.ok(videoDetail.includes("backgroundColor: palette.background"));
assert.ok(videoDetail.includes("backgroundColor: palette.surface"));

for (const path of [
  "features/records/BodyFrameRecordsScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/records/BodyFrameCompareScreen.tsx",
  "features/records/BodyMeasurementHistoryScreen.tsx",
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "features/trip-clip/BodyFrameVideoLibraryScreen.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx",
  "app/photo/[id].tsx"
]) {
  assert.ok(
    read(path).includes("maxWidth: bodyFrameDesign.contentMaxWidth"),
    `missing shared responsive max width: ${path}`
  );
}

assert.ok(records.includes("useWindowDimensions"));
assert.ok(records.includes("width: projectCardWidth"));
assert.ok(!records.includes('width: "48%"'));
assert.ok(videoCreate.includes('width: "72%"'));
assert.ok(videoCreate.includes("maxWidth: 320"));
assert.ok(videoSettings.includes("bodyFrameDesign.contentMaxWidth"));

assert.ok(settings.includes('accessibilityRole="radio"'));
assert.ok(settings.includes("accessibilityState={{ selected: active, disabled }}"));
assert.ok(projectSwitcher.includes("accessibilityState={{ selected, disabled }}"));
assert.ok(projectSwitcher.includes('selected: referenceMode === "first"'));
assert.ok(projectSwitcher.includes('selected: referenceMode === "latest"'));

assert.ok(adminCss.includes(":focus-visible"));
assert.ok(adminCss.includes(".admin-page .backup-item-actions button"));
assert.ok(adminCss.includes("min-height: 44px"));
assert.ok(adminCss.includes("@media (max-width: 520px)"));

console.log("ok - Body Frame UI consistency and accessibility regression");

const videoPolish = read("app/video/[id].tsx");
const photoEditPolish = read("app/edit.tsx");
const videoEditorPolish = read("features/trip-clip/trip-clip-screen.styles.ts");
const accountPolish = read("features/account/account-screen.styles.ts");

const styleBody = (source, key) => {
  const start = source.indexOf(`  ${key}: {`, source.indexOf("StyleSheet.create("));
  assert.ok(start >= 0, `missing ${key} style`);
  const end = source.indexOf("\\n  },", start);
  assert.ok(end > start, `invalid ${key} style`);
  return source.slice(start, end);
};
assert.ok(styleBody(videoPolish, "content").includes("paddingHorizontal: bodyFrameDesign.horizontalPadding"));
assert.ok(styleBody(videoPolish, "title").includes("fontSize: bodyFrameTypography.pageTitle"));
for (const key of ["videoStartButton", "darkButton", "lightButton"]) {
  assert.ok(styleBody(videoPolish, key).includes("bodyFrameDesign.primaryButtonHeight"));
  assert.ok(styleBody(videoPolish, key).includes("bodyFrameDesign.buttonRadius"));
}
assert.ok(styleBody(photoEditPolish, "ghostButton").includes("bodyFrameDesign.minTouchSize"));
assert.ok(styleBody(photoEditPolish, "bottomPanel").includes("bodyFrameDesign.bottomSheetRadius"));
assert.ok(!photoEditPolish.includes("  guideChip: {"), "unused legacy 9px editor guide UI should not return");
assert.ok(styleBody(videoEditorPolish, "timelineDurationKeyboardInput").includes("bodyFrameDesign.minTouchSize"));
assert.ok(styleBody(videoEditorPolish, "timelineDurationKeyboardDoneButton").includes("bodyFrameDesign.minTouchSize"));
assert.ok(styleBody(accountPolish, "musicDeleteButton").includes("bodyFrameDesign.minTouchSize"));
