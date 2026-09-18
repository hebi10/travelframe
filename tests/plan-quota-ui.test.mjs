import assert from "node:assert/strict";

import { readAccountSource } from "./account-test-source.mjs";
import fs from "node:fs";

const accountSource = readAccountSource();
const settingsSource = fs.readFileSync(
  "features/settings/BodyFrameSettingsScreen.tsx",
  "utf8"
);

for (const token of [
  'SectionBlock title="현재 상태"',
  'label="현재 플랜"',
  'label="현재 프로젝트"',
  'label="현재 기록"',
  'SectionBlock title="클라우드 백업"',
  'SectionBlock title="플랜 및 결제"',
  "구매 복원"
]) {
  assert.ok(
    accountSource.includes(token),
    `Body Frame account should contain ${token}`
  );
}

for (const legacy of [
  'SectionBlock title="플랜 한도"',
  "영상 출력 (주간 한도)",
  "이미지 보관함",
  "영상 보관함",
  "음악 보관함",
  'SectionBlock title="사용 기록"',
  'SectionBlock title="내 음악 관리"'
]) {
  assert.equal(
    accountSource.includes(legacy),
    false,
    `Body Frame account should not expose legacy quota UI: ${legacy}`
  );
}

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
    `Body Frame settings should keep ${group}`
  );
}

console.log("ok - Body Frame account and settings expose product-relevant status only");
