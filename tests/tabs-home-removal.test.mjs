import assert from "node:assert/strict";
import fs from "node:fs";

const indexSource = fs.readFileSync("app/index.tsx", "utf8");
const rootLayoutSource = fs.readFileSync("app/_layout.tsx", "utf8");
const tabsLayoutSource = fs.readFileSync("app/(tabs)/_layout.tsx", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const tabGlyphSource = fs.readFileSync("components/tab-glyph.tsx", "utf8");
const appGuideOverlaySource = fs.readFileSync("components/app-guide-overlay.tsx", "utf8");
const useAppGuideSource = fs.readFileSync("hooks/use-app-guide.ts", "utf8");
const guideProgressSource = fs.readFileSync("lib/guide-progress.ts", "utf8");

assert.ok(
  indexSource.includes('href={"/camera" as Href}'),
  "app launch should open the camera tab after removing home"
);

assert.ok(
  !tabsLayoutSource.includes('name="home"'),
  "home should not be rendered as a bottom tab"
);
assert.ok(
  tabsLayoutSource.includes('name="trip-clip"'),
  "trip clip route should remain registered"
);
assert.ok(
  /name="trip-clip"[\s\S]*?href: null[\s\S]*?tabBarStyle: \{ display: "none" \}/.test(
    tabsLayoutSource
  ),
  "clip should be reachable as a hidden route without occupying a bottom tab"
);
assert.ok(
  /name="account"[\s\S]*?title: isLoggedIn \? "마이페이지" : "로그인"[\s\S]*?tabBarIcon: \(\{ focused \}\) => <TabGlyph kind="account" focused=\{focused\} \/>/.test(
    tabsLayoutSource
  ),
  "account should occupy a bottom tab with login or my page label"
);

for (const tabTitle of [
  'title: "촬영"',
  'title: isLoggedIn ? "마이페이지" : "로그인"',
  'title: "보관함"',
  'title: "설정"'
]) {
  assert.ok(tabsLayoutSource.includes(tabTitle), `bottom tabs should include ${tabTitle}`);
}

assert.ok(
  fs.existsSync("app/(tabs)/trip-clip.tsx"),
  "trip clip route should live inside the tabs group"
);
assert.ok(
  !fs.existsSync("app/(tabs)/home.tsx"),
  "home route file should be removed from the tabs group"
);
assert.ok(
  !rootLayoutSource.includes('<Stack.Screen name="trip-clip"'),
  "trip clip should no longer be registered as a standalone stack screen"
);

assert.ok(
  !cameraSource.includes('router.push("/home")'),
  "camera top-left button should no longer navigate to home"
);
assert.ok(
  cameraSource.includes("styles.accountIconButton"),
  "camera top-left button style should be named for the account entry"
);
assert.ok(
  cameraSource.includes('router.push("/account")'),
  "camera top-left button should navigate to account"
);
assert.ok(
  cameraSource.includes('name="user"'),
  "camera top-left button should use a user icon"
);
assert.ok(
  cameraSource.includes('user ? "마이페이지로 이동" : "로그인으로 이동"'),
  "camera account button should expose a login or my page accessibility label"
);

assert.ok(
  !tabGlyphSource.includes('"home"'),
  "tab glyph variants should no longer include home"
);
assert.ok(
  tabGlyphSource.includes('"account"'),
  "tab glyph variants should include account"
);

assert.ok(
  useAppGuideSource.includes('tabKey !== "camera"'),
  "first-run app guide should follow the new camera landing tab"
);
assert.ok(
  !useAppGuideSource.includes('tabKey !== "home"'),
  "app guide should not depend on the removed home tab"
);
assert.ok(
  !guideProgressSource.includes('tabKey === "home"'),
  "guide progress should not keep removed home tab checks"
);
assert.ok(
  appGuideOverlaySource.includes(
    "const activeVisualIndex = Math.min(stepIndex, guideVisualSlides.length - 1)"
  ),
  "guide visuals should stay within available slides when camera guide has more steps"
);

console.log("ok - home removed while account remains in bottom tabs");
