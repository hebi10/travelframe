import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../admin/index.html", import.meta.url), "utf8");
const functionsSource = fs.readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");

for (const snippet of [
  "plus_monthly: {",
  'cardId: "plusMonthlyCard"',
  'productName: "Plus"',
  'priceLabel: "월 3,990원"',
  "expert_monthly: {",
  'cardId: "expertMonthlyCard"',
  'statusId: "expertMonthlyStatusLabel"',
  'detailId: "expertMonthlyDetail"',
  'productName: "Expert"',
  'priceLabel: "월 5,990원"'
]) {
  assert.ok(adminSource.includes(snippet), `admin expert product metadata missing: ${snippet}`);
}

assert.ok(
  adminSource.includes('"ad_remove"') &&
    adminSource.includes('"creator_monthly"') &&
    adminSource.includes('"plus_monthly"') &&
    adminSource.includes('"expert_monthly"'),
  "paid product ordering should include Pro, Plus, and Expert"
);
assert.ok(
  adminSource.includes('<option value="plus_monthly">Plus 월결제</option>') &&
    adminSource.includes('<option value="expert_monthly">Expert 월결제</option>'),
  "subscription product selector should allow Plus and Expert"
);

for (const snippet of [
  'id="plusMonthlyCard"',
  'id="plusMonthlyStatusLabel"',
  'id="plusMonthlyDetail"',
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
  "effective subscription should prioritize active Expert over lower tiers"
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

for (const snippet of [
  "const adminPlanPolicies = {",
  'maxCloudBackupProjects: 1',
  'maxCloudBackupProjects: 3',
  'maxCloudBackupProjects: 5',
  'id="currentPlanEntitlements"',
  'id="selectedPlanEntitlementPreview"'
]) {
  assert.ok(
    adminSource.includes(snippet) || adminHtml.includes(snippet),
    `admin plan entitlement summary missing: ${snippet}`
  );
}

for (const snippet of [
  'const monthlyProductIds = [',
  '"creator_monthly"',
  '"plus_monthly"',
  '"expert_monthly"',
  "deactivatedMonthlyProductIds",
  "syncAdminBackupProjectSlotStatuses",
  'status: "over_limit"'
]) {
  assert.ok(
    functionsSource.includes(snippet),
    `admin monthly-plan exclusivity or slot downgrade guard missing: ${snippet}`
  );
}

console.log("ok - admin subscription UI supports Pro, Plus, and Expert consistently");
