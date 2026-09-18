import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/photo/[id].tsx", "utf8");

for (const token of [
  'bodyFrameDesign',
  'bodyFrameTypography',
  'useAppAppearance',
  'getBodyProjectById',
  '기록 상세',
  'projectLabel',
  'sequenceLabel',
  'label="프로젝트"',
  'label="기록 번호"',
  'label="촬영일"',
  'label="비율"',
  'label="해상도"',
  'label="사진 상태"',
  '핸드폰 앨범에 저장',
  '사진 편집',
  '사진 삭제',
  'returnToRecord',
  'pathname: "/project/[id]"',
  'router.replace("/studio")'
]) {
  assert.ok(
    source.includes(token),
    `Body Frame photo detail should contain ${token}`
  );
}

for (const legacy of [
  'import { colors, controls, spacing, typography }',
  'borderTopWidth',
  'borderBottomWidth',
  'styles.darkButton',
  'styles.lightButton',
  'styles.metaPanel',
  '편집으로 돌아가기',
  '원본 사진',
  '편집 사진'
]) {
  assert.equal(
    source.includes(legacy),
    false,
    `Body Frame photo detail should not keep legacy detail UI: ${legacy}`
  );
}

assert.ok(
  source.includes('backgroundColor: palette.background') &&
    source.includes('backgroundColor: palette.surface') &&
    source.includes('borderColor: palette.line'),
  "photo detail should use the current Body Frame appearance palette"
);

assert.ok(
  source.includes('fontSize: bodyFrameTypography.metric') &&
    source.includes('fontSize: bodyFrameTypography.sectionTitle') &&
    source.includes('fontSize: bodyFrameTypography.body') &&
    source.includes('fontSize: bodyFrameTypography.caption'),
  "photo detail should use Body Frame typography tokens"
);

assert.equal(
  source.includes("BodyMeasurement") ||
    source.includes("weightKg") ||
    source.includes("bodyFatPercent"),
  false,
  "Stage 9-2 should prepare the record-detail layout without prematurely adding measurement storage"
);

assert.ok(
  source.indexOf("recordSummary") < source.indexOf("actions"),
  "record information should appear before actions, leaving a stable insertion point for Stage 9-3 measurements"
);

console.log("Body Frame Stage 9-2 photo-detail contract passed.");
