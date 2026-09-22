import assert from "node:assert/strict";
import fs from "node:fs";

const backButtonFiles = [
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/records/BodyMeasurementHistoryScreen.tsx",
  "app/photo/[id].tsx"
];

for (const path of backButtonFiles) {
  const source = fs.readFileSync(path, "utf8");
  assert.equal(
    source.includes("‹"),
    false,
    `${path} should not render a text glyph as the back icon`
  );
  assert.ok(
    source.includes('name="chevron-left"'),
    `${path} should render the back action with a vector chevron icon`
  );
}

const projectDetailSource = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);

assert.ok(
  projectDetailSource.includes("<View style={styles.modalBackdrop}>"),
  "project settings should use a neutral View as the modal gesture container"
);
assert.ok(
  projectDetailSource.includes("style={StyleSheet.absoluteFill}") &&
    projectDetailSource.includes('accessibilityLabel="프로젝트 설정 닫기"'),
  "the dismiss backdrop should be a separate press target behind the sheet"
);
assert.ok(
  projectDetailSource.includes("nestedScrollEnabled") &&
    projectDetailSource.includes('keyboardShouldPersistTaps="handled"') &&
    projectDetailSource.includes('keyboardDismissMode="on-drag"'),
  "project settings scroll should explicitly support Android nested touch scrolling"
);
assert.ok(
  projectDetailSource.includes("settingsScroll: {") &&
    projectDetailSource.includes("flexShrink: 1"),
  "project settings scroll should remain constrained by the bottom sheet height"
);

console.log("ok - back icons and project settings scroll interaction are stabilized");
