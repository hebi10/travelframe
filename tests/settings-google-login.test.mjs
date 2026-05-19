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
  "Google로 계속하기"
]) {
  assert.ok(settingsSource.includes(snippet), `settings google login missing: ${snippet}`);
}

assert.match(
  settingsSource,
  /disabled=\{isAuthLoading \|\| isAuthSubmitting \|\| isGoogleSubmitting\}[\s\S]*onPress=\{handleGoogleSignIn\}/,
  "settings Google login button must use the Google handler and shared auth disabled state"
);

console.log("ok - settings page includes Google login");
