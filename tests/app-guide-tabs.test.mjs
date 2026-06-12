import assert from "node:assert/strict";
import fs from "node:fs";

const hookSource = fs.readFileSync("hooks/use-app-guide.ts", "utf8");
const stepsSource = fs.readFileSync("constants/app-guide-steps.ts", "utf8");
const progressSource = fs.readFileSync("lib/guide-progress.ts", "utf8");
const overlaySource = fs.readFileSync("components/app-guide-overlay.tsx", "utf8");

for (const tabKey of ["camera", "studio", "tripClip", "account", "settings"]) {
  assert.ok(stepsSource.includes(`${tabKey}: [`), `guide steps should define ${tabKey}`);
}

assert.equal(
  hookSource.includes('tabKey !== "camera"'),
  false,
  "useAppGuide should not hard-code first-run guide display to camera only"
);
assert.ok(
  hookSource.includes("steps.length <= 0"),
  "useAppGuide should skip undefined or empty guide step lists"
);
assert.ok(
  hookSource.includes("shouldShowInitialAppGuide()"),
  "useAppGuide should consult the global first-visit guide progress"
);
assert.ok(
  hookSource.includes("isAuthLoading || isLoggedIn"),
  "useAppGuide should only auto-open for logged-out users after auth loading"
);
assert.equal(
  hookSource.includes("shouldShowGuideForTab(tabKey)"),
  false,
  "useAppGuide should not auto-open once per tab"
);

assert.equal(
  progressSource.includes("seenTabs: createCompletedSeenTabs()"),
  false,
  "existing users with no stored guide progress should not auto-complete every current and future tab guide"
);
assert.ok(
  progressSource.includes("createExistingUserSeenTabs"),
  "guide progress should have an explicit existing-user migration policy"
);
assert.ok(
  progressSource.includes("seenTabs: createExistingUserSeenTabs()"),
  "existing users should only pre-complete legacy guide tabs, leaving new tab guides available"
);
assert.ok(
  overlaySource.includes("Array.from({ length: totalSteps })"),
  "guide overlay swipe pages should be based on guide step count, not visual asset count"
);
assert.ok(
  overlaySource.includes("Math.min(totalSteps - 1, nextIndex)"),
  "guide overlay swipe should allow reaching the final guide step"
);

console.log("ok - app guide supports all defined tabs");
