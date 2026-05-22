import assert from "node:assert/strict";
import fs from "node:fs";

const settingsSource = fs.readFileSync(
  new URL("../app/(tabs)/settings.tsx", import.meta.url),
  "utf8"
);

for (const snippet of [
  "signInWithGoogleIdToken",
  "const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);",
  "const handleGoogleSignIn = () => {",
  'await import("expo-auth-session")',
  'scopes: ["openid", "profile", "email"]',
  'prompt: "select_account"',
  "await signInWithGoogleIdToken(idToken);",
  "Google로 계속하기",
  "Google 로그인 설정값을 확인해 주세요.",
  "Google 로그인 승인 코드를 받지 못했습니다.",
  "Google 로그인 토큰을 받지 못했습니다.",
  "Google 계정으로 로그인했습니다.",
  "Google 로그인을 취소했습니다.",
  "Google 로그인 중 문제가 발생했습니다.",
  "Google 로그인을 사용할 수 없습니다. 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요."
]) {
  assert.ok(settingsSource.includes(snippet), `settings google login missing: ${snippet}`);
}

assert.ok(
  !/[嚥獄筌濡諛醫怨]/.test(settingsSource),
  "settings Google login copy must not include mojibake characters"
);

assert.match(
  settingsSource,
  /disabled=\{isAuthLoading \|\| isAuthSubmitting \|\| isGoogleSubmitting\}[\s\S]*onPress=\{handleGoogleSignIn\}/,
  "settings Google login button must use the Google handler and shared auth disabled state"
);

console.log("ok - settings page includes Google login");
