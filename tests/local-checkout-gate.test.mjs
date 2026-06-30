import assert from "node:assert/strict";
import fs from "node:fs";

const subscriptionSource = fs.readFileSync("lib/subscription.ts", "utf8");

assert.match(
  subscriptionSource,
  /export const isLocalCheckoutEnabled =\s*__DEV__ && process\.env\.EXPO_PUBLIC_ENABLE_LOCAL_CHECKOUT === "true"/,
  "local checkout should only be enabled in explicit development builds"
);

assert.doesNotMatch(
  subscriptionSource,
  /isPremiumSubscription\(cachedSubscription\)[\s\S]*?\?\s*cachedSubscription/,
  "cached local subscription must not be promoted over the verified server subscription"
);

assert.match(
  subscriptionSource,
  /if \(!isLocalCheckoutEnabled\) \{[\s\S]*?throw new Error\("결제 기능은 출시 준비 중입니다\."\);[\s\S]*?\}/,
  "local checkout writes should be blocked when the dev gate is off"
);

console.log("ok - local checkout is gated off outside explicit dev builds");
