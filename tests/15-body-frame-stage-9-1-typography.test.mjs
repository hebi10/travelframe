import assert from "node:assert/strict";
import fs from "node:fs";

const themeSource = fs.readFileSync("constants/app-theme.ts", "utf8");
const recordsSource = fs.readFileSync(
  "features/records/BodyFrameRecordsScreen.tsx",
  "utf8"
);
const detailSource = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);
const cameraStyles = fs.readFileSync(
  "features/camera/camera-screen.styles.ts",
  "utf8"
);

for (const token of [
  "pageTitle: 26",
  "projectTitle: 24",
  "sectionTitle: 18",
  "metric: 22",
  "body: 14",
  "caption: 12",
  "button: 14"
]) {
  assert.ok(
    themeSource.includes(token),
    `Body Frame typography scale should contain ${token}`
  );
}

for (const [name, source] of [
  ["records", recordsSource],
  ["project detail", detailSource],
  ["camera", cameraStyles]
]) {
  assert.equal(
    /fontSize:\s*(?:9|10|11)\b/.test(source),
    false,
    `${name} should not expose literal 9-11px text in the primary Body Frame UI`
  );
}

assert.ok(
  recordsSource.includes(
    "projectPercent: {\n    fontSize: bodyFrameTypography.caption"
  ) &&
    recordsSource.includes(
      "projectDuration: {\n    fontSize: bodyFrameTypography.caption"
    ),
  "project cards should use the readable shared caption size"
);

assert.ok(
  detailSource.includes(
    "projectName: {\n    fontSize: bodyFrameTypography.projectTitle"
  ) &&
    detailSource.includes(
      "progressCount: {\n    fontSize: bodyFrameTypography.metric"
    ),
  "project detail should use the compact project-title and metric tokens"
);

assert.ok(
  detailSource.includes(
    '{photo.sequence ? `#${photo.sequence}` : "기록"}'
  ),
  "3-column photo tiles should show a short sequence label"
);
assert.equal(
  detailSource.includes(
    '{photo.sequence ? `#${photo.sequence} · ` : ""}'
  ),
  false,
  "3-column photo tiles should not compress sequence and date into tiny visible text"
);
assert.ok(
  detailSource.includes(
    'accessibilityLabel={`${photo.sequence ?? ""}번째 기록 ${formatDate(photo.createdAt)}`}'
  ),
  "photo tiles should retain the full date in their accessibility label"
);

for (const token of [
  "overlaySetupHint: {",
  "compactSliderLabel: {",
  "compactSliderValue: {",
  "colorLabel: {",
  "cameraColorHint: {",
  "overlayQuickLabel: {",
  "gallerySavingText: {"
]) {
  const index = cameraStyles.indexOf(token);
  assert.ok(index >= 0, `camera style should contain ${token}`);
  const block = cameraStyles.slice(index, index + 260);
  assert.ok(
    block.includes("fontSize: bodyFrameTypography.caption"),
    `${token} should use the 12px Body Frame caption token`
  );
}

const manualQa = fs.readFileSync("docs/manual-device-qa.md", "utf8");
for (const token of [
  "100% / 약 130% / 약 150%",
  "9~10px급 초소형 문구",
  "과도하게 크게"
]) {
  assert.ok(
    manualQa.includes(token),
    `manual mobile typography QA should contain ${token}`
  );
}

console.log("Body Frame Stage 9-1 mobile typography contract passed.");
