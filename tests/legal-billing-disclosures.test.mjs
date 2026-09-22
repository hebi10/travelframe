import assert from "node:assert/strict";
import fs from "node:fs";

const legalLinks = fs.readFileSync("constants/legal-links.ts", "utf8");
const settings = fs.readFileSync(
  "features/settings/BodyFrameSettingsScreen.tsx",
  "utf8"
);
const account = fs.readFileSync(
  "features/account/AccountScreen.tsx",
  "utf8"
);
const accountConstants = fs.readFileSync(
  "features/account/account-screen.constants.ts",
  "utf8"
);
const termsSource = fs.readFileSync(
  "privacy/terms-of-service.md",
  "utf8"
);
const termsPublic = fs.readFileSync(
  "admin/terms/index.html",
  "utf8"
);

for (const token of [
  "TERMS_OF_SERVICE_URL",
  "GOOGLE_PLAY_SUBSCRIPTIONS_URL",
  "https://travelframe-4e1fb.web.app/terms",
  "https://play.google.com/store/account/subscriptions"
]) {
  assert.ok(legalLinks.includes(token), `legal link missing: ${token}`);
}

assert.ok(
  settings.includes('label="이용약관"') &&
    settings.includes("TERMS_OF_SERVICE_URL"),
  "settings should expose the terms of service"
);

for (const token of [
  "Google Play 구독 관리",
  "Google Play에서 구독 관리",
  "TERMS_OF_SERVICE_URL",
  "PRIVACY_POLICY_URL",
  "purchaseNotice",
  "1회 결제 · 자동 갱신 없음",
  "월 구독 · 취소 전까지 자동 갱신",
  "환불 여부는 Google Play 정책"
]) {
  assert.ok(account.includes(token), `account billing UI missing: ${token}`);
}

for (const token of [
  "1회성 구매",
  "정기 결제나 자동 갱신이 발생하지 않",
  "월 구독",
  "자동으로 갱신",
  "Google Play 정기 결제",
  "앱을 삭제해도 구독이 자동 취소되지는 않습니다",
  "실제 결제 금액은 Google Play 구매 화면"
]) {
  assert.ok(
    accountConstants.includes(token),
    `payment disclosure missing: ${token}`
  );
}

for (const source of [termsSource, termsPublic]) {
  for (const token of [
    "Google Play",
    "광고 제거",
    "Pro / Expert",
    "자동으로 갱신",
    "구독 관리",
    "취소",
    "환불",
    "앱을 삭제"
  ]) {
    assert.ok(source.includes(token), `terms disclosure missing: ${token}`);
  }
}

console.log("ok - app legal links and Google Play billing disclosures are present");
