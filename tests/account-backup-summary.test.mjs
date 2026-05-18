import assert from "node:assert/strict";
import fs from "node:fs";

const accountSource = fs.readFileSync(
  new URL("../app/(tabs)/account.tsx", import.meta.url),
  "utf8"
);

for (const snippet of [
  "subscribeCloudBackupOverview",
  "getAppSettings",
  'SectionBlock title="클라우드 백업"',
  'label="백업 설정"',
  'label="백업 데이터"',
  'label="마지막 백업"',
  'label="삭제 방식"',
  'value="설정에서 직접 요청"',
  "기존 백업 데이터 삭제는 설정에서 직접 요청할 수 있습니다."
]) {
  assert.ok(accountSource.includes(snippet), `account backup summary missing: ${snippet}`);
}

console.log("ok - account page includes cloud backup summary");
