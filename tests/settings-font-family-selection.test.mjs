import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appFontsSource = readFileSync("lib/app-fonts.tsx", "utf8");
const appSettingsSource = readFileSync("lib/app-settings.ts", "utf8");
const appAppearanceSource = readFileSync("lib/app-appearance.ts", "utf8");
const rootLayoutSource = readFileSync("app/_layout.tsx", "utf8");
const settingsSource = [
  readFileSync("app/(tabs)/settings.tsx", "utf8"),
  readFileSync("features/settings/settings-screen.components.tsx", "utf8")
].join("\n");

for (const snippet of [
  "Noto Sans KR",
  "Nanum Gothic",
  "Gowun Dodum",
  "Gugi",
  "Black Han Sans"
]) {
  assert.ok(appFontsSource.includes(snippet), `font option missing: ${snippet}`);
}

assert.equal(
  (appFontsSource.match(/license: "SIL Open Font License 1.1",\n\s+licenseUrl/g) ?? []).length,
  5,
  "all recommended fonts should use a commercial-friendly OFL license"
);

for (const snippet of [
  "useFonts(APP_FONT_SOURCES)",
  "FontLoadProvider",
  "useAppFontsReady",
  'source: require("../assets/fonts/NotoSansKR.ttf")',
  'source: require("../assets/fonts/NanumGothic-Regular.ttf")',
  'source: require("../assets/fonts/GowunDodum-Regular.ttf")',
  'source: require("../assets/fonts/Gugi-Regular.ttf")',
  'source: require("../assets/fonts/BlackHanSans-Regular.ttf")',
  "[option.family]: option.source"
]) {
  assert.ok(appFontsSource.includes(snippet), `font loading setup missing: ${snippet}`);
}

assert.ok(
  !appFontsSource.includes("[option.family]: { uri: option.sourceUri }"),
  "runtime font loading should use bundled local assets, not remote URLs"
);

assert.ok(
  rootLayoutSource.includes("<FontLoadProvider>") &&
    rootLayoutSource.includes("</FontLoadProvider>"),
  "root layout should load app fonts before rendering app chrome"
);

assert.ok(
  appSettingsSource.includes(
    'export type FontStyle = "noto_sans_kr" | "nanum_gothic" | "gowun_dodum" | "gugi" | "black_han_sans"'
  ),
  "font style setting should represent the five selectable font families"
);
assert.ok(
  appSettingsSource.includes('const legacyFontStyles = ["standard", "compact", "bold"]'),
  "stored legacy font style values should be normalized safely"
);

assert.ok(
  appAppearanceSource.includes("fontFamily: getFontFamilyForStyle(settings.fontStyle, fontsReady)") &&
    appAppearanceSource.includes("useAppFontsReady()"),
  "appearance hook should expose the selected loaded font family"
);

assert.ok(
  settingsSource.includes("APP_FONT_OPTIONS") &&
    settingsSource.includes("fontFamilyPreview={font.value}") &&
    settingsSource.includes("fontFamily: previewFontFamily"),
  "font style modal should preview each option using its own font family"
);

console.log("ok - settings font style selects five commercial-use font families");
