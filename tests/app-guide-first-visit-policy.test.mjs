import assert from "node:assert/strict";
import fs from "node:fs";

const hookSource = fs.readFileSync("hooks/use-app-guide.ts", "utf8");
const progressSource = fs.readFileSync("lib/guide-progress.ts", "utf8");
const overlaySource = fs.readFileSync("components/app-guide-overlay.tsx", "utf8");

for (const snippet of [
  'import { useAuth } from "@/lib/auth-context";',
  "const { isAuthLoading, isLoggedIn } = useAuth();",
  "if (isAuthLoading || isLoggedIn) {",
  "shouldShowInitialAppGuide()",
  "markAppGuideIntroSeen()"
]) {
  assert.ok(hookSource.includes(snippet), `app guide hook first-visit policy missing: ${snippet}`);
}

assert.ok(
  !hookSource.includes("shouldShowGuideForTab(tabKey)"),
  "automatic app guide display should not be checked per tab"
);
assert.ok(
  hookSource.includes("replaySignal <= 0"),
  "manual replay should remain separate from first-visit auto display"
);

for (const snippet of [
  "export const shouldShowInitialAppGuide = async () => {",
  "return !progress.seenIntro;",
  "export const markAppGuideIntroSeen = async () =>",
  "seenIntro: true"
]) {
  assert.ok(progressSource.includes(snippet), `guide progress intro policy missing: ${snippet}`);
}

assert.ok(
  overlaySource.includes("useAppGuide(tabKey, replaySignal)"),
  "guide overlay should keep using the shared hook policy"
);

console.log("ok - app guide auto-opens only once for logged-out first visits");
