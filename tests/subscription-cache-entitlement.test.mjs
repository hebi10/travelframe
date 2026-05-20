import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const subscriptionSource = read("lib/subscription.ts");
const authContextSource = read("lib/auth-context.tsx");

assert.ok(
  subscriptionSource.includes('export type SubscriptionCheckStatus = "loading" | "verified" | "failed";'),
  "subscription status must represent loading, verified, and failed states"
);

assert.ok(
  subscriptionSource.includes("verifiedSubscription") &&
    subscriptionSource.includes("cachedSubscription"),
  "subscription state must keep verified entitlement separate from local display cache"
);

assert.equal(
  /catch\s*\{[\s\S]*return\s+getLocalSubscription\(user\.uid\)/.test(subscriptionSource),
  false,
  "Firestore failures must not return local subscription cache as entitlement"
);

assert.equal(
  /return\s+getSubscriptionProductsFromSubscription\(await getLocalSubscription\(user\.uid\)\)/.test(
    subscriptionSource
  ),
  false,
  "Firestore product lookup failures must not return cached premium products as entitlements"
);

assert.ok(
  authContextSource.includes("verifiedSubscription") &&
    authContextSource.includes("cachedSubscription") &&
    authContextSource.includes("subscriptionStatus"),
  "auth context must expose verified subscription, cached subscription, and status separately"
);

assert.ok(
  /hasFullAccess:[\s\S]*isPremiumSubscription\(verifiedSubscription\)/.test(authContextSource),
  "hasFullAccess must be calculated from the verified server subscription only"
);

assert.ok(
  /hasFullAccess:[\s\S]*subscriptionStatus === "verified"[\s\S]*isPremiumSubscription\(verifiedSubscription\)/.test(
    authContextSource
  ),
  "hasFullAccess must stay false while subscription verification is loading or failed"
);

assert.equal(
  /hasFullAccess:[\s\S]*isPremiumSubscription\(subscription\)/.test(authContextSource),
  false,
  "hasFullAccess must not depend on the display subscription value"
);

console.log("ok - cached subscription is not trusted for entitlements");
