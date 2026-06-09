import assert from "node:assert/strict";
import fs from "node:fs";

const helperPath = "lib/google-auth.ts";
assert.ok(fs.existsSync(helperPath), "Google auth flow should live in a shared helper");

const helperSource = fs.readFileSync(helperPath, "utf8");
const accountSource = fs.readFileSync("app/(tabs)/account.tsx", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");

for (const snippet of [
  "signInWithGoogleAuthSession",
  'await import("expo-auth-session")',
  'scopes: ["openid", "profile", "email"]',
  'prompt: "select_account"',
  "com.haebi.photoguide:/oauthredirect",
  "Google 로그인 설정값을 확인해 주세요.",
  "Google 로그인 승인 코드를 받지 못했습니다.",
  "Google 로그인 토큰을 받지 못했습니다.",
  "Google 로그인 중 문제가 발생했습니다.",
  "Google 로그인을 사용할 수 없습니다. 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요."
]) {
  assert.ok(helperSource.includes(snippet), `shared Google auth helper missing: ${snippet}`);
}

for (const [label, source] of [
  ["account", accountSource],
  ["settings", settingsSource]
]) {
  assert.ok(
    source.includes("signInWithGoogleAuthSession"),
    `${label} should call the shared Google auth helper`
  );
  assert.equal(
    source.includes('await import("expo-auth-session")'),
    false,
    `${label} should not duplicate the AuthSession flow`
  );
  assert.equal(
    source.includes("new AuthSession.AuthRequest"),
    false,
    `${label} should not create its own Google AuthRequest`
  );
  assert.ok(
    source.includes("Google로 계속하기"),
    `${label} should preserve the Google login button copy`
  );
}

for (const [label, source] of [
  ["account", accountSource],
  ["settings", settingsSource]
]) {
  assert.match(
    source,
    /const handleGoogleSignIn = \(\) => \{\s*if \(isGoogleSubmitting\) \{\s*return;\s*\}/,
    `${label} Google login handler should ignore re-entry while a Google login is in progress`
  );
}

assert.match(
  helperSource,
  /Boolean\(androidClientId\)/,
  "Android Google AuthSession should be configured by the Android client id actually used for the request"
);
assert.doesNotMatch(
  helperSource,
  /Boolean\(webClientId && androidClientId\)/,
  "Android Google AuthSession should not require an unused web client id"
);

console.log("ok - Google login flow is shared by account and settings");
