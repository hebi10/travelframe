import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const publicDeletePage = readFileSync("privacy/photo-guide-delete-account.html", "utf8");
const adminDeletePage = readFileSync("admin/privacy/photo-guide-delete-account.html", "utf8");
const publicPrivacyPage = readFileSync("privacy/index.html", "utf8");
const adminPrivacyPage = readFileSync("admin/privacy/index.html", "utf8");
const privacyMarkdown = readFileSync("privacy/privacy-policy.md", "utf8");

for (const [name, source] of [
  ["public delete page", publicDeletePage],
  ["admin delete page", adminDeletePage]
]) {
  for (const snippet of [
    "클라우드 백업 데이터는",
    "앱 설정에서 직접 삭제할 수 있고",
    "설정 탭을 엽니다.",
    "백업 데이터 삭제",
    "Firebase에 저장된 백업 파일과 백업 기록이 삭제됩니다.",
    "계정 또는 전체 데이터 삭제 요청",
    "사용자 음악 삭제",
    "앱에서 직접 실행한 백업 데이터 삭제는 요청 즉시 처리됩니다."
  ]) {
    assert.ok(source.includes(snippet), `${name} should include: ${snippet}`);
  }

  assert.equal(
    source.includes("요청 내용: 계정 삭제, 백업 데이터 삭제, 전체 데이터 삭제 중 선택"),
    false,
    `${name} should not tell users to email for backup-only deletion`
  );
}

for (const [name, source] of [
  ["public privacy page", publicPrivacyPage],
  ["admin privacy page", adminPrivacyPage],
  ["privacy markdown", privacyMarkdown]
]) {
  assert.ok(
    source.includes("기존 클라우드 백업 데이터는") && source.includes("설정 화면"),
    `${name} should describe manual backup deletion in settings`
  );
  assert.equal(
    source.includes("만료 후 3개월"),
    false,
    `${name} should not describe automatic deletion after three months`
  );
}

console.log("ok - delete account page copy matches in-app backup deletion policy");
