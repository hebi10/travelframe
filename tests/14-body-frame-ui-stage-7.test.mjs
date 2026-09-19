import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const appJson = JSON.parse(fs.readFileSync("app.json", "utf8"));
const appIcon = fs.readFileSync("assets/icons/app-icon.png");
const adaptiveIcon = fs.readFileSync("assets/icons/adaptive-icon.png");

const pngDimensions = (buffer) => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
  colorType: buffer.readUInt8(25)
});

const sha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

assert.equal(appJson.expo.icon, "./assets/icons/app-icon.png");
assert.equal(
  appJson.expo.android.adaptiveIcon.foregroundImage,
  "./assets/icons/adaptive-icon.png"
);
assert.equal(
  appJson.expo.android.adaptiveIcon.backgroundColor,
  "#151719"
);

assert.deepEqual(pngDimensions(appIcon), {
  width: 1024,
  height: 1024,
  colorType: 6
});
assert.deepEqual(pngDimensions(adaptiveIcon), {
  width: 1024,
  height: 1024,
  colorType: 6
});

assert.equal(
  sha256(appIcon),
  "891e4d5fb09248587d0547ca09c00c31a833c9d1a750f571e3ceaf14b87447c7",
  "app icon should match the approved body outline and frame asset"
);
assert.equal(
  sha256(adaptiveIcon),
  "0438c59759fe1ffdf898c2010b057f61a358a167a207e6777df954df74b365df",
  "adaptive foreground should match the approved symbol with safe-area padding"
);

const primaryUiFiles = [
  "components/app-guide-overlay.tsx",
  "features/camera/BodyFrameCameraScreen.tsx",
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "features/camera/camera-screen.styles.ts",
  "features/records/BodyFrameRecordsScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx",
  "features/account/AccountScreen.tsx",
  "features/account/account-screen.styles.ts"
];

for (const path of primaryUiFiles) {
  const source = fs.readFileSync(path, "utf8");

  assert.equal(
    /border(?:Top|Bottom|Left|Right)Width\s*:/.test(source),
    false,
    `${path} should not use one-sided separator borders`
  );

  for (const legacy of ["트래블프레임", "TravelFrame", "여행클립"]) {
    assert.equal(
      source.includes(legacy),
      false,
      `${path} should not expose legacy product copy: ${legacy}`
    );
  }

  for (const decoration of ["shadowOpacity", "shadowColor", "elevation:", "LinearGradient"]) {
    assert.equal(
      source.includes(decoration),
      false,
      `${path} should keep the flat Body Frame visual language: ${decoration}`
    );
  }
}

const cameraStyles = fs.readFileSync(
  "features/camera/camera-screen.styles.ts",
  "utf8"
);
for (const token of [
  "overlayButton: {\n    minHeight: bodyFrameDesign.minTouchSize",
  "overlayCompactButton: {\n    minHeight: bodyFrameDesign.minTouchSize",
  "overlayConfirmButton: {\n    minHeight: bodyFrameDesign.minTouchSize",
  "modalCloseButton: {\n    minHeight: bodyFrameDesign.minTouchSize",
  "optionButton: {\n    minHeight: bodyFrameDesign.minTouchSize",
  "cameraColorCloseButton: {\n    width: bodyFrameDesign.minTouchSize",
  "height: bodyFrameDesign.minTouchSize",
  "quickPillButton: {\n    minWidth: 48,\n    minHeight: bodyFrameDesign.minTouchSize",
  "opacityStepButton: {\n    width: bodyFrameDesign.minTouchSize"
]) {
  assert.ok(
    cameraStyles.includes(token),
    `camera touch-target contract should contain ${token}`
  );
}

const accountStyles = fs.readFileSync(
  "features/account/account-screen.styles.ts",
  "utf8"
);
assert.ok(
  accountStyles.includes(
    "segmentButton: {\n    minHeight: bodyFrameDesign.minTouchSize"
  ),
  "account auth segment controls should meet the shared touch target"
);
assert.ok(
  accountStyles.includes(
    "modalCloseButton: {\n    minHeight: bodyFrameDesign.minTouchSize"
  ),
  "account modal close control should meet the shared touch target"
);
assert.ok(
  accountStyles.includes("infoRow: {") &&
    accountStyles.includes("borderWidth: bodyFrameDesign.borderWidth"),
  "account status rows should use full borders rather than one-sided separators"
);

console.log("Body Frame UI Stage 7 brand/accessibility contract passed.");
