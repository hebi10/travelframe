import assert from "node:assert/strict";
import fs from "node:fs";

const appThemeSource = fs.readFileSync("constants/app-theme.ts", "utf8");
const tabsSource = fs.readFileSync("app/(tabs)/_layout.tsx", "utf8");
const guideCardSource = fs.readFileSync("components/app-guide-card.tsx", "utf8");
const settingsSource = fs.readFileSync(
  "features/settings/BodyFrameSettingsScreen.tsx",
  "utf8"
);

const bodyFrameUiFiles = [
  "app/(tabs)/_layout.tsx",
  "components/app-guide-card.tsx",
  "features/camera/BodyFrameCameraScreen.tsx",
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "features/records/BodyFrameRecordsScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx"
];

for (const token of [
  "horizontalPadding: 16",
  "sectionGap: 28",
  "controlGap: 10",
  "minTouchSize: 44",
  "primaryButtonHeight: 48",
  "cardRadius: 8",
  "buttonRadius: 8",
  "modalRadius: 10",
  "bottomSheetRadius: 12",
  "borderWidth: 1",
  "bodyFrameTypography"
]) {
  assert.ok(
    appThemeSource.includes(token),
    `Body Frame design tokens should contain ${token}`
  );
}

for (const path of bodyFrameUiFiles) {
  const source = fs.readFileSync(path, "utf8");
  assert.ok(
    source.includes("bodyFrameDesign"),
    `${path} should consume shared Body Frame design tokens`
  );
  assert.equal(
    /border(?:Top|Bottom|Left|Right)Width/.test(source),
    false,
    `${path} should not use one-sided borders in the primary Body Frame UI`
  );
}

assert.equal(
  settingsSource.includes('label="글꼴"'),
  false,
  "Body Frame settings should not expose font-family selection"
);
assert.equal(
  settingsSource.includes("getFontOptionLabel"),
  false,
  "Body Frame settings should not depend on the legacy font selector"
);
assert.ok(
  tabsSource.includes("minHeight: bodyFrameDesign.minTouchSize"),
  "bottom navigation should use the shared minimum touch target"
);
assert.equal(
  tabsSource.includes("borderTopWidth"),
  false,
  "bottom navigation should not rely on a one-sided separator border"
);
assert.equal(
  guideCardSource.includes("borderTopWidth"),
  false,
  "guide card should not use a one-sided border"
);

console.log("Body Frame UI Stage 1 design-system contract passed.");
