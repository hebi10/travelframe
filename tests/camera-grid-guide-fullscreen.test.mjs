import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const guideOverlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");
const cameraStylesSource = fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8");

for (const snippet of [
  'guide === "grid"',
  "styles.gridOverlay",
  "...StyleSheet.absoluteFillObject",
  "styles.gridVertical",
  "styles.gridHorizontal"
]) {
  assert.ok(guideOverlaySource.includes(snippet), `fullscreen grid guide missing: ${snippet}`);
}

assert.ok(
  guideOverlaySource.includes("<View style={styles.gridOverlay}>"),
  "grid guide should fill the overlay instead of using the adjustable guide frame"
);

assert.ok(
  cameraSource.includes('guide !== "grid"') &&
    cameraSource.includes("{ translateX: guideOffsetXValue }") &&
    cameraSource.includes("{ translateY: guideOffsetYValue }"),
  "camera grid guide should not be shifted by saved guide offsets"
);

const guideSettingsStart = cameraSource.indexOf("<ScrollView");
const guideSelectorStart = cameraSource.indexOf("가이드라인", guideSettingsStart);
const sizeSectionStart = cameraSource.indexOf("크기", guideSelectorStart);
const guideSelectorSource = cameraSource.slice(guideSelectorStart, sizeSectionStart);

assert.ok(
  guideSelectorSource.includes("GUIDE_TYPES.map") &&
    !guideSelectorSource.includes('guide !== "grid"'),
  "grid guide should keep the guide type selector visible after 3-split is selected"
);

assert.ok(
  cameraSource.includes("<GuideSizeSlider") &&
    cameraSource.includes("compact") &&
    cameraSource.includes("applyGuideSize(option.value)"),
  "grid guide should keep compact size fine controls visible"
);

assert.ok(
  cameraSource.includes('{guide !== "grid" ? (') &&
    cameraSource.includes("startGuidePositionAdjustment"),
  "grid guide should still hide drag movement because it is fixed to the full camera frame"
);

assert.ok(
  cameraStylesSource.includes("guideSettingsContent:") &&
    cameraStylesSource.includes("gap: 16") &&
    cameraStylesSource.includes("sizeFineControl:") &&
    cameraStylesSource.includes("minHeight: 44"),
  "guide settings modal should reduce middle spacing so lower controls remain visible"
);

assert.ok(
  !guideOverlaySource.includes("gridFrame"),
  "grid guide should not keep the old adjustable square frame style"
);

console.log("ok - camera grid guide keeps settings visible while filling the preview");
