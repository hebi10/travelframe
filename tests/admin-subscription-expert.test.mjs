import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../admin/index.html", import.meta.url), "utf8");

for (const snippet of [
  "expert_monthly: {",
  'cardId: "expertMonthlyCard"',
  'statusId: "expertMonthlyStatusLabel"',
  'detailId: "expertMonthlyDetail"',
  'productName: "Expert"',
  "주 30개",
  "5GiB",
  "음악 20개"
]) {
  assert.ok(adminSource.includes(snippet), `admin expert product metadata missing: ${snippet}`);
}

assert.ok(
  adminSource.includes('const paidProductIds = ["ad_remove", "creator_monthly", "expert_monthly"];'),
  "paid product ordering should include expert after creator"
);
assert.ok(
  adminSource.includes('<option value="expert_monthly">Expert 월결제</option>'),
  "subscription product selector should allow Expert"
);

for (const snippet of [
  'id="expertMonthlyCard"',
  'id="expertMonthlyStatusLabel"',
  'id="expertMonthlyDetail"'
]) {
  assert.ok(adminHtml.includes(snippet), `admin expert subscription summary missing: ${snippet}`);
}

const effectiveSubscriptionStart = adminSource.indexOf("const getEffectiveSubscription =");
const renderCardsStart = adminSource.indexOf("const renderSubscriptionCards =", effectiveSubscriptionStart);
assert.ok(effectiveSubscriptionStart >= 0, "getEffectiveSubscription should exist");
assert.ok(renderCardsStart > effectiveSubscriptionStart, "renderSubscriptionCards should follow effective subscription");
const effectiveSubscriptionSource = adminSource.slice(effectiveSubscriptionStart, renderCardsStart);
assert.ok(
  effectiveSubscriptionSource.indexOf("subscriptions.expert_monthly") >= 0 &&
    effectiveSubscriptionSource.indexOf("subscriptions.expert_monthly") <
      effectiveSubscriptionSource.indexOf("subscriptions.creator_monthly"),
  "effective subscription should prioritize active Expert over Creator"
);

assert.ok(
  adminSource.includes('productId !== "ad_remove" && subscription?.expiresAt'),
  "subscription cards should show expiration dates for monthly products including Expert"
);
assert.ok(
  adminSource.includes('$("productExpiresInput").disabled = productId === "ad_remove";'),
  "expiration date input should remain enabled for Creator and Expert monthly products"
);
assert.ok(
  adminSource.includes('expiresAt: productId === "ad_remove" ? null : expiresAt,'),
  "subscription save should send expiration dates for Creator and Expert through the callable"
);
assert.ok(
  adminSource.includes('const setAdminProductSubscription = httpsCallable(functions, "setAdminProductSubscription");') &&
    adminSource.includes("await setAdminProductSubscription({"),
  "admin Expert subscription saves should stay on the callable flow"
);

console.log("ok - admin subscription UI supports Expert products consistently");
