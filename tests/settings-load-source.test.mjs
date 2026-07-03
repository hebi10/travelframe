import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");

assert.match(
  source,
  /const latestSubscription = user \? await getUserSubscription\(user\) : subscription;/,
  "settings focus load should refresh the subscription before quota-sensitive work"
);
assert.match(
  source,
  /const latestPlanEntitlements = getPlanEntitlements\(\{[\s\S]*?subscription: latestSubscription[\s\S]*?\}\);/,
  "settings focus load should derive quota limits from the latest subscription"
);
assert.match(
  source,
  /loadSettings\(\)\.catch\(\(error\) => \{[\s\S]*?setAuthMessage\(getUserFacingErrorMessage\(error,/,
  "settings focus load should catch async load failures and show a user-facing message"
);

console.log("ok - settings focus load catches failures and uses fresh subscription");
