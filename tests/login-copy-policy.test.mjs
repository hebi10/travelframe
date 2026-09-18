import assert from "node:assert/strict";
import fs from "node:fs";

const accountSource = [
  fs.readFileSync("features/account/AccountScreen.tsx", "utf8"),
  fs.readFileSync("features/account/account-screen.constants.ts", "utf8")
].join("\n");
const settingsSource = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");

for (const snippet of [
  "무료 플랜은 프로젝트당 100장과 최대 10초 변화 영상을 지원합니다.",
  "무료 플랜: 프로젝트당 최대 100장 기록",
  "변화 영상 최대 10초",
  "클라우드 백업은 Pro부터 사용 가능"
]) {
  assert.ok(accountSource.includes(snippet), `account copy should include ${snippet}`);
}

assert.ok(
  settingsSource.includes("프로젝트당 100장과 최대 10초 변화 영상을 사용할 수 있습니다."),
  "advanced settings login copy should follow Body Frame free-plan limits"
);

for (const stale of [
  "무료 로그인하면 사진 편집과 MP4 영상 주 1회 저장을 사용할 수 있습니다.",
  "사진 편집과 MP4 영상 주 1회"
]) {
  assert.equal(
    accountSource.includes(stale),
    false,
    `primary account copy should remove stale TravelFrame entitlement wording: ${stale}`
  );
}

console.log("ok - login copy follows Body Frame plan policy");
