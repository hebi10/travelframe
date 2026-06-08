import assert from "node:assert/strict";
import fs from "node:fs";

const nativeModuleName = "react-native-google-mobile-ads";
const nativeFiles = [
  "components/google-mobile-banner.tsx",
  "components/google-mobile-interstitial.ts",
  "lib/admob-native.ts"
];

for (const filePath of nativeFiles) {
  const source = fs.readFileSync(filePath, "utf8");

  assert.equal(
    source.includes(`from "${nativeModuleName}"`),
    false,
    `${filePath} must not statically import the AdMob native module`
  );
  assert.ok(
    source.includes(`require("${nativeModuleName}")`),
    `${filePath} should lazy require the AdMob native module`
  );
  assert.ok(
    /try\s*\{[\s\S]*require\("react-native-google-mobile-ads"\)[\s\S]*\}\s*catch/.test(source),
    `${filePath} should catch missing native module errors`
  );
}

const bannerSource = fs.readFileSync("components/google-mobile-banner.tsx", "utf8");
assert.ok(
  bannerSource.includes("return null"),
  "banner wrapper should render nothing when the native module is unavailable"
);

console.log("ok - AdMob native module is loaded lazily");
