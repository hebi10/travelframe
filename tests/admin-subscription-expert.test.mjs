import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../admin/index.html", import.meta.url), "utf8");

for (const snippet of [
  "plus_monthly: {",
  'cardId: "plusMonthlyCard"',
  'productName: "Plus"',
  'priceLabel: "월 4,000원"',
  "expert_monthly: {",
  'cardId: "expertMonthlyCard"',
  'statusId: "expertMonthlyStatusLabel"',
  'detailId: "expertMonthlyDetail"',
  'productName: "Expert"',
  'priceLabel: "월 6,000원"'
]) {
  assert.ok(adminSource.includes(snippet), `admin product metadata missing: ${snippet}`);
}

for (const option of [
  '<option value="ad_remove">광고 제거 · 1회성</option>',
  '<option value="creator_monthly">Pro · 1개월 구독</option>',
  '<option value="plus_monthly">Plus · 1개월 구독</option>',
  '<option value="expert_monthly">Expert · 1개월 구독</option>'
]) {
  assert.ok(adminSource.includes(option), `subscription product selector missing: ${option}`);
}

for (const snippet of [
  'id="plusMonthlyCard"',
  'id="plusMonthlyStatusLabel"',
  'id="plusMonthlyDetail"',
  'id="expertMonthlyCard"',
  'id="expertMonthlyStatusLabel"',
  'id="expertMonthlyDetail"'
]) {
  assert.ok(adminHtml.includes(snippet), `admin subscription summary missing: ${snippet}`);
}

const effectiveSubscriptionStart = adminSource.indexOf("const getEffectiveSubscription =");
const renderCardsStart = adminSource.indexOf("const renderSubscriptionCards =", effectiveSubscriptionStart);
const effectiveSubscriptionSource = adminSource.slice(effectiveSubscriptionStart, renderCardsStart);
assert.ok(
  effectiveSubscriptionSource.indexOf("subscriptions.expert_monthly") >= 0 &&
    effectiveSubscriptionSource.indexOf("subscriptions.expert_monthly") <
      effectiveSubscriptionSource.indexOf("subscriptions.creator_monthly"),
  "effective subscription should prioritize active Expert over lower tiers"
);

assert.ok(
  adminSource.includes('productId !== "ad_remove" && subscription?.expiresAt'),
  "monthly product cards should show expiration dates"
);
assert.ok(
  adminSource.includes('$("productExpiresInput").disabled = isOneTime') &&
    adminSource.includes('$("subscriptionDurationSelect").disabled = isOneTime'),
  "one-time ad removal should disable subscription period controls"
);
assert.ok(
  adminSource.includes("startedAt,") &&
    adminSource.includes("expiresAt,") &&
    adminSource.includes("termMonths,"),
  "monthly plan save should send its configured period to the server callable"
);
assert.ok(
  adminSource.includes('const setAdminProductSubscription = httpsCallable(functions, "setAdminProductSubscription");') &&
    adminSource.includes("await setAdminProductSubscription({"),
  "admin subscription saves should stay on the callable flow"
);

console.log("ok - admin subscription UI supports one-time ad removal and all monthly plan tiers");
