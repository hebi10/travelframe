import assert from "node:assert/strict";
import fs from "node:fs";

const subscriptionSource = fs.readFileSync("lib/subscription.ts", "utf8");
const planEntitlementsSource = fs.readFileSync("lib/plan-entitlements.ts", "utf8");
const subscriptionProductsSource = fs.readFileSync("lib/subscription-products.ts", "utf8");

assert.match(
  subscriptionSource,
  /export const isLocalCheckoutEnabled =\s*typeof __DEV__ !== "undefined" &&\s*__DEV__ &&\s*process\.env\.EXPO_PUBLIC_ENABLE_LOCAL_CHECKOUT === "true"/,
  "local checkout should only be enabled in explicit development builds"
);

assert.match(
  subscriptionSource,
  /subscription\.provider === "local_checkout" && !isLocalCheckoutEnabled/,
  "local checkout provider should not count as a premium subscription when the dev gate is off"
);

for (const [name, source] of [
  ["plan entitlements", planEntitlementsSource],
  ["subscription products", subscriptionProductsSource]
]) {
  assert.match(
    source,
    /subscription\.provider === "local_checkout" && !isLocalCheckoutEnabled/,
    `${name} should reject local checkout premium access when the dev gate is off`
  );
}

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
