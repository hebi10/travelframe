import assert from "node:assert/strict";
import fs from "node:fs";

const screens = [
  ["studio", "StudioScreen", "features/studio/StudioScreen.tsx"],
  ["account", "AccountScreen", "features/account/AccountScreen.tsx"],
  ["settings", "SettingsScreen", "features/settings/SettingsScreen.tsx"],
  ["camera", "CameraScreen", "features/camera/CameraScreen.tsx"],
  ["trip-clip", "TripClipScreen", "features/trip-clip/TripClipScreen.tsx"]
];

for (const [route, screenName, screenPath] of screens) {
  const routePath = `app/(tabs)/${route}.tsx`;
  const routeSource = fs.readFileSync(routePath, "utf8");

  assert.ok(fs.existsSync(screenPath), `screen file should exist: ${screenPath}`);
  assert.ok(
    routeSource.includes(`import ${screenName} from "@/features/`),
    `${routePath} should import ${screenName} from features`
  );
  assert.ok(routeSource.includes(`export default ${screenName};`), `${routePath} should export ${screenName}`);
  assert.ok(
    routeSource.split(/\r?\n/).length <= 10,
    `${routePath} should stay as a thin Expo Router wrapper`
  );
}

console.log("ok - tab routes delegate to feature screen modules");
