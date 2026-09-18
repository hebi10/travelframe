import assert from "node:assert/strict";
import fs from "node:fs";

const indexSource = fs.readFileSync("app/index.tsx", "utf8");
const rootLayoutSource = fs.readFileSync("app/_layout.tsx", "utf8");
const tabsLayoutSource = fs.readFileSync("app/(tabs)/_layout.tsx", "utf8");
const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const tabGlyphSource = fs.readFileSync("components/tab-glyph.tsx", "utf8");
const appGuideOverlaySource = fs.readFileSync("components/app-guide-overlay.tsx", "utf8");
const useAppGuideSource = fs.readFileSync("hooks/use-app-guide.ts", "utf8");
const guideProgressSource = fs.readFileSync("lib/guide-progress.ts", "utf8");

assert.ok(
  indexSource.includes('href={"/camera" as Href}'),
  "app launch should open the camera tab after removing home"
);

assert.ok(!tabsLayoutSource.includes('name="home"'), "home should not be rendered as a bottom tab");

for (const tabTitle of [
  'title: "촬영"',
  'title: "기록"',
  'title: "영상"',
  'title: "설정"'
]) {
  assert.ok(tabsLayoutSource.includes(tabTitle), `bottom tabs should include ${tabTitle}`);
}

const getTabScreenBlock = (name) => {
  const start = tabsLayoutSource.indexOf(`name="${name}"`);
  const nextScreen = tabsLayoutSource.indexOf("<Tabs.Screen", start + 1);
  return tabsLayoutSource.slice(
    start,
    nextScreen >= 0 ? nextScreen : tabsLayoutSource.length
  );
};

const accountTabBlock = getTabScreenBlock("account");
const videoTabBlock = getTabScreenBlock("trip-clip");

assert.ok(
  accountTabBlock.includes("href: null"),
  "account should remain routable but hidden from the bottom navigation"
);
assert.equal(
  videoTabBlock.includes("href: null"),
  false,
  "video should occupy a visible bottom tab"
);
assert.ok(
  !/name="camera"[\s\S]*?tabBarStyle: \{ display: "none" \}/.test(tabsLayoutSource),
  "camera should keep the shared bottom navigation visible"
);

assert.ok(fs.existsSync("app/(tabs)/trip-clip.tsx"), "video route should live inside the tabs group");
assert.ok(!fs.existsSync("app/(tabs)/home.tsx"), "home route file should remain removed");
assert.ok(
  !rootLayoutSource.includes('<Stack.Screen name="trip-clip"'),
  "video should remain a tabs route rather than a duplicate standalone stack route"
);

assert.ok(!cameraSource.includes('router.push("/home")'), "camera must not navigate to removed home");
assert.ok(
  cameraSource.includes('router.push("/account")'),
  "camera account shortcut may continue to open the hidden account route"
);

assert.ok(!tabGlyphSource.includes('"home"'), "tab glyph variants should not include home");
assert.ok(tabGlyphSource.includes('"video"'), "tab glyph variants should include video");
assert.ok(!tabGlyphSource.includes('"account"'), "hidden account route should not need a bottom-tab glyph");
assert.ok(
  tabGlyphSource.includes("activeIndicator"),
  "active bottom tab should use a short underline indicator"
);

assert.ok(
  useAppGuideSource.includes('tabKey !== "camera"'),
  "first-run onboarding should only open automatically on the camera entry"
);
assert.equal(
  useAppGuideSource.includes('tabKey !== "home"'),
  false,
  "guide progress should not keep removed home-tab conditions"
);
assert.ok(
  !guideProgressSource.includes('tabKey === "home"'),
  "guide progress should not keep removed home tab checks"
);
assert.equal(
  appGuideOverlaySource.includes("guideVisualSlides"),
  false,
  "Body Frame onboarding should not depend on old travel visual slides"
);

console.log("ok - Body Frame uses four primary bottom tabs");
