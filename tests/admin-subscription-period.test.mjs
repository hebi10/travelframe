import assert from "node:assert/strict";
import fs from "node:fs";

const admin = fs.readFileSync("admin/admin.js", "utf8");
const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const subscriptionSource = fs.readFileSync("lib/subscription.ts", "utf8");

for (const token of [
  'id="productStartInput"',
  'id="subscriptionDurationSelect"',
  'id="productExpiresInput"',
  "addCalendarMonths",
  "getMonthDistance",
  "const syncSubscriptionExpiry = () =>",
  "startedAt,",
  "expiresAt,",
  "termMonths,"
]) {
  assert.ok(admin.includes(token), `admin subscription period control missing: ${token}`);
}

assert.ok(
  admin.includes('$("productStartInput").disabled = isOneTime') &&
    admin.includes('$("productExpiresInput").disabled = isOneTime') &&
    admin.includes('$("subscriptionDurationSelect").disabled = isOneTime'),
  "one-time ad removal must not expose subscription dates"
);

for (const token of [
  "const isMonthlyProduct = [",
  "const safeStartedAt =",
  "const safeExpiresAt =",
  "const safeTermMonths =",
  'status === "active"',
  '"Active monthly subscriptions require valid startedAt and expiresAt values."',
  '"Subscription expiresAt must be later than startedAt."',
  'provider: "admin"',
  "termMonths: productId === \"ad_remove\" ? null : safeTermMonths",
  "const shouldSwitchMonthlyPlan = isMonthlyProduct && status === \"active\"",
  "ADMIN_MONTHLY_PRODUCT_IDS",
  'status: "inactive"',
  "startedAt: subscription.startedAt",
  "expiresAt: subscription.expiresAt"
]) {
  assert.ok(functionsSource.includes(token), `server admin subscription validation missing: ${token}`);
}

assert.ok(
  subscriptionSource.includes('provider: "none" | "admin" | "google_play"'),
  "the app subscription parser should accept admin-provided plans"
);
assert.ok(
  subscriptionSource.includes("new Date(subscription.expiresAt).getTime() > Date.now()"),
  "admin-configured expiration dates should participate in app entitlement checks"
);

console.log("ok - admin can assign one-time ad removal and exclusive configurable monthly plan periods");
