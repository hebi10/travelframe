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
  "8088be1abc9cfdb9f2d1c28a53af820dd321f1be9328b3409c073daabdbb7899",
  "app icon should match the approved body outline and frame asset"
);
assert.equal(
  sha256(adaptiveIcon),
  "2560aa25185687dcbf24b0bf62d1c681b46a6fdc25b028549175f9de3e9a5064",
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
  "optionButton: {\n    minHeight: bodyFrameDesign.minTouchSize",
  "height: bodyFrameDesign.minTouchSize",
  "quickPillButton: {\n    minWidth: 48,\n    minHeight: bodyFrameDesign.minTouchSize",
  "opacityStepButton: {\n    width: bodyFrameDesign.minTouchSize"
]) {
  assert.ok(
    cameraStyles.includes(token),
    `camera touch-target contract should contain ${token}`
  );
}

for (const [name, properties] of [
  ["modalCloseButton", ["minHeight", "minWidth"]],
  ["cameraColorCloseButton", ["width", "height"]]
]) {
  const block = cameraStyles.match(new RegExp(`${name}: \\{([^}]+)\\}`))?.[1];
  assert.ok(block, `${name} touch target must exist`);
  for (const property of properties) {
    assert.match(block, new RegExp(`${property}: bodyFrameDesign\\.minTouchSize`), `${name}.${property}`);
  }
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
