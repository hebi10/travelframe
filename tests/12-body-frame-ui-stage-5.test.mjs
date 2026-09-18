import assert from "node:assert/strict";
import fs from "node:fs";

const videoSource = fs.readFileSync(
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "utf8"
);
const settingsSource = fs.readFileSync(
  "features/settings/BodyFrameSettingsScreen.tsx",
  "utf8"
);

for (const token of [
  '<SummaryRow label="사진 수"',
  '<SummaryRow label="사진 간격"',
  '<SummaryRow label="영상 길이"',
  '<SummaryRow label="화질"',
  '<SummaryRow label="화면 비율"'
]) {
  assert.ok(
    videoSource.includes(token),
    `Body Frame video summary should contain ${token}`
  );
}

for (const removedSummary of [
  '<SummaryRow label="플랜 한도"',
  '<SummaryRow label="프레임"',
  '<SummaryRow label="전환 효과"'
]) {
  assert.equal(
    videoSource.includes(removedSummary),
    false,
    `Body Frame video summary should not expose ${removedSummary}`
  );
}

assert.ok(
  videoSource.includes("!videoLimitState.allowed"),
  "plan-limit guidance should still appear when the current video exceeds the plan"
);
assert.ok(
  videoSource.includes("플랜 보기"),
  "over-limit videos should keep an upgrade path"
);

for (const group of [
  "촬영",
  "저장 및 백업",
  "변화 영상",
  "화면",
  "계정 및 플랜",
  "정보 및 개인정보"
]) {
  assert.ok(
    settingsSource.includes(`SectionBlock title="${group}"`),
    `Body Frame settings should keep the ${group} group`
  );
}

for (const token of [
  'label="사진 간격"',
  'label="출력 규격"',
  'label="글자 크기"',
  'label="사용 가이드"',
  "fontSizeLabel[settings.fontSize]"
]) {
  assert.ok(
    settingsSource.includes(token),
    `Body Frame settings should contain ${token}`
  );
}

for (const removed of [
  'label="영상 세부 설정"',
  'label="화면 세부 설정"',
  'label="고급 설정"',
  'label="기존 편집 보관함"',
  'router.push("/legacy-studio")'
]) {
  assert.equal(
    settingsSource.includes(removed),
    false,
    `primary Body Frame settings should not expose ${removed}`
  );
}

assert.ok(
  settingsSource.includes('router.push("/advanced-settings")'),
  "group-specific detail rows should retain access to advanced compatibility settings"
);
assert.ok(
  fs.existsSync("app/legacy-studio.tsx"),
  "legacy studio route should remain preserved for compatibility"
);

console.log("Body Frame UI Stage 5 video/settings contract passed.");
