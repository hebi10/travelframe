import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourceUrl = new URL("../lib/subscription-products.ts", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const { getSubscriptionProductsFromSubscription } = await import(
  `data:text/javascript,${encodeURIComponent(transpiled)}`
);

const baseSubscription = {
  plan: "premium",
  status: "active",
  provider: "google_play",
  startedAt: "2026-05-18T00:00:00.000Z",
  expiresAt: null,
  lastPaymentAt: "2026-05-18T00:00:00.000Z",
  priceLabel: "3,900원",
  productName: "광고 제거"
};

const adProducts = getSubscriptionProductsFromSubscription({
  ...baseSubscription,
  productId: "ad_remove"
});
assert.equal(adProducts.adRemove?.productId, "ad_remove");
assert.equal(adProducts.creatorMonthly, null);
assert.equal(adProducts.expertMonthly, null);

const creatorProducts = getSubscriptionProductsFromSubscription({
  ...baseSubscription,
  productId: "creator_monthly",
  expiresAt: "2999-01-01T00:00:00.000Z",
  productName: "구독"
});
assert.equal(creatorProducts.adRemove, null);
assert.equal(creatorProducts.creatorMonthly?.productId, "creator_monthly");
assert.equal(creatorProducts.expertMonthly, null);

const expertProducts = getSubscriptionProductsFromSubscription({
  ...baseSubscription,
  productId: "expert_monthly",
  expiresAt: "2999-01-01T00:00:00.000Z",
  priceLabel: "9,900원",
  productName: "전문가"
});
assert.equal(expertProducts.adRemove, null);
assert.equal(expertProducts.creatorMonthly, null);
assert.equal(expertProducts.expertMonthly?.productId, "expert_monthly");

const expiredCreatorProducts = getSubscriptionProductsFromSubscription({
  ...baseSubscription,
  productId: "creator_monthly",
  expiresAt: "2000-01-01T00:00:00.000Z",
  productName: "구독"
});
assert.equal(expiredCreatorProducts.adRemove, null);
assert.equal(expiredCreatorProducts.creatorMonthly, null);
assert.equal(expiredCreatorProducts.expertMonthly, null);

console.log("ok - subscription products can be derived from active subscription");
