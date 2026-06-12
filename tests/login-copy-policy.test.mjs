import assert from "node:assert/strict";
import fs from "node:fs";

const accountSource = [
  fs.readFileSync("app/(tabs)/account.tsx", "utf8"),
  fs.readFileSync("features/account/account-screen.constants.ts", "utf8")
].join("\n");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");

for (const snippet of [
  "무료 로그인하면 사진 편집과 MP4 영상 주 1회 저장을 사용할 수 있습니다.",
  "Pro부터 워터마크 제거와 클라우드 백업이 제공됩니다.",
  "사진 편집과 MP4 영상 주 1회",
  "클라우드 백업은 Pro부터 사용 가능"
]) {
  assert.ok(accountSource.includes(snippet), `account/login copy should include: ${snippet}`);
}

for (const snippet of [
  "비로그인 상태에서는 촬영과 앱 보관함 저장만 사용할 수 있습니다.",
  "로그인하면 사진 편집과 MP4 영상 주 1회 기능을 사용할 수 있습니다.",
  "Pro 기능과 클라우드 백업을 사용할 수 있습니다."
]) {
  assert.ok(settingsSource.includes(snippet), `settings/login copy should include: ${snippet}`);
}

assert.equal(
  settingsSource.includes("비로그인 상태에서는 무료 기능과 워터마크가 적용됩니다."),
  false,
  "settings should not describe logged-out users as having free-login features"
);
assert.equal(
  settingsSource.includes("전체 기능을 사용할 수 있습니다."),
  false,
  "settings should not claim every logged-in user has all features"
);

console.log("ok - login and account copy match guest, free, and Pro policies");
