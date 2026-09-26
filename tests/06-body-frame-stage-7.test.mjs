import assert from "node:assert/strict";
import fs from "node:fs";

const appJson = JSON.parse(fs.readFileSync("app.json", "utf8"));
const tabsSource = fs.readFileSync("app/(tabs)/_layout.tsx", "utf8");
const tabGlyphSource = fs.readFileSync("components/tab-glyph.tsx", "utf8");
const appThemeSource = fs.readFileSync("constants/app-theme.ts", "utf8");
const appearanceSource = fs.readFileSync("lib/app-appearance.ts", "utf8");
const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const guideSource = fs.readFileSync("components/app-guide-overlay.tsx", "utf8");
const guideStepsSource = fs.readFileSync("constants/app-guide-steps.ts", "utf8");

assert.equal(appJson.expo.name, "바디 프레임");
assert.equal(appJson.expo.android.package, "com.haebi.photoguide");
assert.ok(
  Array.isArray(appJson.expo.scheme) && appJson.expo.scheme.includes("bodyframe"),
  "Body Frame scheme should be added without changing Android package"
);
assert.ok(
  appJson.expo.description.includes("몸의 변화"),
  "app description should describe Body Frame progress recording"
);
assert.equal(
  JSON.stringify(appJson).includes("트래블프레임"),
  false,
  "app metadata and permission copy should not expose TravelFrame branding"
);

for (const [route, title] of [
  ['name="camera"', 'title: "촬영"'],
  ['name="studio"', 'title: "기록"'],
  ['name="trip-clip"', 'title: "영상"'],
  ['name="settings"', 'title: "설정"']
]) {
  assert.ok(tabsSource.includes(route), `tabs should include ${route}`);
  assert.ok(tabsSource.includes(title), `tabs should include ${title}`);
}
assert.ok(
  /name="account"[\s\S]{0,180}?href:\s*null/.test(tabsSource),
  "Account should remain routable but hidden from bottom navigation"
);
assert.equal(
  /name="trip-clip"[\s\S]{0,180}?href:\s*null/.test(tabsSource),
  false,
  "video tab should be visible"
);
assert.equal(
  /name="camera"[\s\S]{0,220}?tabBarStyle:\s*\{\s*display:\s*"none"/.test(tabsSource),
  false,
  "camera tab should keep the shared bottom navigation visible"
);
assert.ok(
  tabGlyphSource.includes('"video"') &&
    tabGlyphSource.includes("activeIndicator"),
  "tab glyph should support video and short active underline"
);
assert.equal(
  tabGlyphSource.includes("backgroundColor: focused ? palette.ink"),
  false,
  "selected tab should not use a filled icon tile"
);

assert.ok(
  fs.existsSync("features/records/BodyFrameRecordsScreen.tsx"),
  "project-first records screen should exist"
);
assert.ok(
  fs.existsSync("features/records/BodyFrameProjectDetailScreen.tsx"),
  "project detail screen should exist"
);
assert.ok(
  fs.existsSync("app/project/[id].tsx"),
  "project detail route should exist"
);
assert.ok(
  fs.existsSync("app/legacy-studio.tsx"),
  "legacy studio should remain available outside the primary tabs"
);
const studioRoute = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");
assert.ok(
  studioRoute.includes("BodyFrameRecordsScreen"),
  "records tab should route to the Body Frame project list"
);
const recordsSource = fs.readFileSync(
  "features/records/BodyFrameRecordsScreen.tsx",
  "utf8"
);
for (const token of [
  "getBodyProjects",
  "getPhotos",
  "getBodyProjectProgressSummary",
  "setLastActiveProjectId",
  "/project/"
]) {
  assert.ok(recordsSource.includes(token), `records screen should contain ${token}`);
}

assert.equal(
  recordsSource.includes("기존 편집 보관함 열기"),
  false,
  "legacy editor entry should not clutter the primary records screen"
);

assert.ok(
  recordsSource.includes("보관된 프로젝트") &&
    recordsSource.includes("archiveBodyProject") &&
    recordsSource.includes("archiveBodyProject(project.id, false)"),
  "archived projects should have a reversible restore path from Records"
);
const detailSource = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);
for (const token of [
  "getBodyProjectById",
  "updateBodyProject",
  "archiveBodyProject",
  '"first"',
  '"latest"',
  "보관"
]) {
  assert.ok(detailSource.includes(token), `project detail should contain ${token}`);
}

for (const token of [
  "getPlanEntitlements",
  "isBodyFrameProjectTargetAllowed",
  "maxProgressPhotos",
  "getBodyFrameUpgradeLabel",
  "플랜 보기"
]) {
  assert.ok(
    detailSource.includes(token),
    `project detail target editing should preserve Stage 5 plan limit via ${token}`
  );
}

assert.ok(
  detailSource.includes("target !== project.targetPhotoCount"),
  "a downgraded user must still be able to rename a project whose existing target exceeds the current plan"
);

assert.ok(
  fs.existsSync("features/settings/BodyFrameSettingsScreen.tsx"),
  "Body Frame settings home should exist"
);
assert.ok(
  fs.existsSync("app/advanced-settings.tsx"),
  "legacy detailed settings route should exist"
);
const settingsRoute = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");
assert.ok(
  settingsRoute.includes("BodyFrameSettingsScreen"),
  "settings tab should use the new Body Frame settings home"
);
const settingsSource = fs.readFileSync(
  "features/settings/BodyFrameSettingsScreen.tsx",
  "utf8"
);
for (const group of [
  "촬영",
  "저장 및 백업",
  "변화 영상",
  "화면",
  "계정 및 플랜",
  "정보 및 개인정보"
]) {
  assert.ok(settingsSource.includes(group), `settings home should contain ${group}`);
}
assert.ok(settingsSource.includes("/advanced-settings"));
assert.ok(settingsSource.includes("/account"));

assert.equal(
  settingsSource.includes("/legacy-studio") ||
    settingsSource.includes("기존 편집 보관함"),
  false,
  "legacy studio should remain preserved as a route without cluttering the primary Body Frame settings home"
);

for (const token of [
  "function BodyFrameSettingRow",
  "minHeight: 64",
  'flexDirection: "row"',
  'justifyContent: "space-between"'
]) {
  assert.ok(
    settingsSource.includes(token),
    `Body Frame settings should use compact horizontal rows via ${token}`
  );
}

for (const token of [
  "#0B0B0C",
  "#131315",
  "#1A1A1D",
  "#2A2A2E",
  "#F5F5F5",
  "#A0A0A6",
  "#68686E"
]) {
  assert.ok(
    appThemeSource.includes(token) || appearanceSource.includes(token),
    `approved Body Frame palette should contain ${token}`
  );
}
assert.ok(
  appSettingsSource.includes('themeMode: "dark"'),
  "dark mode should be the default for new installs"
);

const videoScreenSource = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "utf8"
);
assert.ok(
  videoScreenSource.includes("useAppAppearance"),
  "Body Frame video screen should follow the shared light/dark palette"
);
assert.equal(
  videoScreenSource.includes('backgroundColor: "#0B0B0C"'),
  false,
  "video screen should not hard-code the dark page background"
);

assert.ok(
  guideStepsSource.includes("APP_GUIDE_VERSION = 4"),
  "Body Frame onboarding should increment guide version"
);
assert.equal(
  guideSource.includes("home-slide-camera.png") ||
    guideSource.includes("home-slide-edit.png") ||
    guideSource.includes("home-slide-video.png"),
  false,
  "new onboarding should not use old travel slide images"
);
for (const token of ["바디 프레임에 오신 것을 환영합니다.", "같은 위치와 자세", "변화 영상"]) {
  assert.ok(
    guideSource.includes(token) || guideStepsSource.includes(token),
    `onboarding should contain ${token}`
  );
}

console.log("ok - Body Frame stage 7 brand and primary UX contracts are enforced");
