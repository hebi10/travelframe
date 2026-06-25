import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourceUrl = new URL("../lib/plan-entitlements.ts", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const {
  PLAN_ENTITLEMENTS,
  getPlanEntitlements,
  getPlanTier,
  getWeeklyVideoExportLimit
} = await import(`data:text/javascript,${encodeURIComponent(transpiled)}`);

const activeSubscription = (productId) => ({
  plan: "premium",
  status: "active",
  provider: "google_play",
  productId,
  startedAt: "2026-05-20T00:00:00.000Z",
  expiresAt: "2999-01-01T00:00:00.000Z",
  lastPaymentAt: "2026-05-20T00:00:00.000Z",
  priceLabel: "1,990원",
  productName: productId
});

assert.equal(getPlanTier({ isLoggedIn: false, subscription: null }), "guest");
assert.equal(getPlanTier({ isLoggedIn: true, subscription: null }), "free");
assert.equal(
  getPlanTier({ isLoggedIn: true, subscription: activeSubscription("ad_remove") }),
  "ad_remove"
);
assert.equal(
  getPlanTier({ isLoggedIn: true, subscription: activeSubscription("creator_monthly") }),
  "pro"
);
assert.equal(
  getPlanTier({ isLoggedIn: true, subscription: activeSubscription("premium") }),
  "pro"
);
const legacyPremiumWithoutProductId = activeSubscription(undefined);
delete legacyPremiumWithoutProductId.productId;
assert.equal(
  getPlanTier({ isLoggedIn: true, subscription: legacyPremiumWithoutProductId }),
  "pro"
);
assert.equal(
  getPlanTier({ isLoggedIn: true, subscription: activeSubscription("expert_monthly") }),
  "expert"
);

assert.equal(PLAN_ENTITLEMENTS.guest.canExportVideo, false);
assert.equal(PLAN_ENTITLEMENTS.guest.localImageLimit, 100);
assert.equal(PLAN_ENTITLEMENTS.guest.localVideoLimit, 30);
assert.equal(PLAN_ENTITLEMENTS.free.canExportVideo, true);
assert.equal(PLAN_ENTITLEMENTS.free.weeklyVideoExportLimit, 1);
assert.equal(PLAN_ENTITLEMENTS.free.showWatermark, true);
assert.equal(PLAN_ENTITLEMENTS.free.showAds, true);
assert.equal(PLAN_ENTITLEMENTS.free.localImageLimit, 100);
assert.equal(PLAN_ENTITLEMENTS.free.localVideoLimit, 30);

assert.equal(PLAN_ENTITLEMENTS.ad_remove.canExportVideo, true);
assert.equal(PLAN_ENTITLEMENTS.ad_remove.weeklyVideoExportLimit, 1);
assert.equal(PLAN_ENTITLEMENTS.ad_remove.showAds, false);
assert.equal(PLAN_ENTITLEMENTS.ad_remove.showWatermark, true);
assert.equal(PLAN_ENTITLEMENTS.ad_remove.canBackupToCloud, false);

assert.equal(PLAN_ENTITLEMENTS.pro.weeklyVideoExportLimit, 15);
assert.equal(PLAN_ENTITLEMENTS.pro.canExportVideo, true);
assert.equal(PLAN_ENTITLEMENTS.pro.showAds, false);
assert.equal(PLAN_ENTITLEMENTS.pro.showWatermark, false);
assert.equal(PLAN_ENTITLEMENTS.pro.localImageLimit, 200);
assert.equal(PLAN_ENTITLEMENTS.pro.localVideoLimit, 50);
assert.equal(PLAN_ENTITLEMENTS.pro.musicTrackLimit, 10);
assert.equal(PLAN_ENTITLEMENTS.pro.backupStorageBytes, 2 * 1024 * 1024 * 1024);

assert.equal(PLAN_ENTITLEMENTS.expert.weeklyVideoExportLimit, 30);
assert.equal(PLAN_ENTITLEMENTS.expert.canExportVideo, true);
assert.equal(PLAN_ENTITLEMENTS.expert.localImageLimit, 300);
assert.equal(PLAN_ENTITLEMENTS.expert.localVideoLimit, 100);
assert.equal(PLAN_ENTITLEMENTS.expert.musicTrackLimit, 20);
assert.equal(PLAN_ENTITLEMENTS.expert.backupStorageBytes, 5 * 1024 * 1024 * 1024);

const proEntitlements = getPlanEntitlements({
  isLoggedIn: true,
  subscription: activeSubscription("creator_monthly")
});
assert.equal(proEntitlements.label, "Pro");
assert.equal(getWeeklyVideoExportLimit(proEntitlements), 15);

console.log("ok - plan entitlements describe guest, free, ad removal, pro, and expert tiers");
