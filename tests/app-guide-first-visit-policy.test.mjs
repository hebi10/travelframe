import assert from "node:assert/strict";
import fs from "node:fs";

const hookSource = fs.readFileSync("hooks/use-app-guide.ts", "utf8");
const progressSource = fs.readFileSync("lib/guide-progress.ts", "utf8");
const overlaySource = fs.readFileSync("components/app-guide-overlay.tsx", "utf8");

for (const snippet of [
  'tabKey !== "camera"',
  "shouldShowInitialAppGuide()",
  "markAppGuideIntroSeen()"
]) {
  assert.ok(
    hookSource.includes(snippet),
    `app guide hook first-visit policy missing: ${snippet}`
  );
}

for (const removed of [
  'import { useAuth } from "@/lib/auth-context";',
  "isAuthLoading",
  "isLoggedIn",
  "shouldShowGuideForTab(tabKey)"
]) {
  assert.equal(
    hookSource.includes(removed),
    false,
    `first-run welcome should not depend on legacy auth/per-tab policy: ${removed}`
  );
}

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
  assert.ok(
    progressSource.includes(snippet),
    `guide progress intro policy missing: ${snippet}`
  );
}

assert.ok(
  overlaySource.includes("useAppGuide(tabKey, replaySignal)") &&
    overlaySource.includes("isWelcome") &&
    overlaySource.includes("시작하기"),
  "guide overlay should keep the shared first-run/replay policy"
);

console.log("ok - app guide auto-opens once on first camera entry regardless of auth");
