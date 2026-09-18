import assert from "node:assert/strict";
import fs from "node:fs";

const hookSource = fs.readFileSync("hooks/use-app-guide.ts", "utf8");
const stepsSource = fs.readFileSync("constants/app-guide-steps.ts", "utf8");
const progressSource = fs.readFileSync("lib/guide-progress.ts", "utf8");
const overlaySource = fs.readFileSync("components/app-guide-overlay.tsx", "utf8");

for (const tabKey of ["camera", "studio", "tripClip", "account", "settings"]) {
  assert.ok(stepsSource.includes(`${tabKey}: [`), `guide steps should define ${tabKey}`);
}

assert.ok(
  hookSource.includes('tabKey !== "camera"'),
  "first-run guide should auto-open only on the camera entry"
);
assert.ok(
  hookSource.includes("steps.length <= 0"),
  "useAppGuide should skip undefined or empty guide step lists"
);
assert.ok(
  hookSource.includes("shouldShowInitialAppGuide()"),
  "useAppGuide should consult the global first-visit guide progress"
);
assert.equal(
  hookSource.includes("isAuthLoading") || hookSource.includes("isLoggedIn") || hookSource.includes("useAuth"),
  false,
  "first-run welcome should not depend on authentication state"
);
assert.equal(
  hookSource.includes("shouldShowGuideForTab(tabKey)"),
  false,
  "useAppGuide should not auto-open once per tab"
);

assert.equal(
  progressSource.includes("seenTabs: createCompletedSeenTabs()"),
  false,
  "existing users should not auto-complete every current and future guide"
);
assert.ok(
  progressSource.includes("createExistingUserSeenTabs"),
  "guide progress should retain an explicit existing-user migration policy"
);
assert.ok(
  progressSource.includes("seenTabs: createExistingUserSeenTabs()"),
  "existing users should preserve the existing camera-guide migration"
);

assert.equal(
  overlaySource.includes("guideVisualSlides"),
  false,
  "Body Frame guide should not keep the old travel visual slide carousel"
);
assert.ok(
  overlaySource.includes("isWelcome") &&
    overlaySource.includes("시작하기") &&
    overlaySource.includes("AppGuideCard") &&
    overlaySource.includes("onNext={goNext}"),
  "Body Frame guide should support the single welcome modal and replayable guide cards"
);

console.log("ok - app guide matches final Body Frame onboarding");
