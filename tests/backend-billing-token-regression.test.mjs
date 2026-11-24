import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { shouldUpdateSubscriptionForPurchase, canUseLinkedPurchase, canExpireLinkedSubscription } = require('../functions/google-play-billing-policy.js');
assert.equal(canUseLinkedPurchase({ linkedPurchase: { uid: 'alice' }, uid: 'bob' }), false);
assert.equal(canUseLinkedPurchase({ linkedPurchase: { uid: 'alice' }, uid: 'alice' }), true);
assert.equal(canUseLinkedPurchase({ linkedPurchase: undefined, uid: 'alice' }), true);
assert.equal(canExpireLinkedSubscription({ existingProduct: { provider: 'google_play', googlePurchaseTokenHash: 'new' }, linkedHash: 'old' }), false);
assert.equal(canExpireLinkedSubscription({ existingProduct: { provider: 'google_play', googlePurchaseTokenHash: 'old' }, linkedHash: 'old' }), true);
assert.equal(canExpireLinkedSubscription({ existingProduct: { provider: 'admin', googlePurchaseTokenHash: 'old' }, linkedHash: 'old' }), false);
assert.equal(shouldUpdateSubscriptionForPurchase({ purchase: { supersededBy: 'new' }, existingProduct: { googlePurchaseTokenHash: 'new' }, tokenHash: 'old', active: false }), false);
assert.equal(shouldUpdateSubscriptionForPurchase({ purchase: {}, existingProduct: { googlePurchaseTokenHash: 'new' }, tokenHash: 'old', active: false }), false);
assert.equal(shouldUpdateSubscriptionForPurchase({ purchase: {}, existingProduct: { googlePurchaseTokenHash: 'same' }, tokenHash: 'same', active: false }), true);
assert.equal(shouldUpdateSubscriptionForPurchase({ purchase: {}, existingProduct: null, tokenHash: 'new', active: true }), true);
assert.equal(shouldUpdateSubscriptionForPurchase({ purchase: {}, existingProduct: { googlePurchaseTokenHash: 'new' }, tokenHash: 'old', active: true, source: 'rtdn' }), false);
console.log('ok - obsolete purchase tokens cannot revoke the current subscription');

assert.equal(shouldUpdateSubscriptionForPurchase({
  purchase: {}, existingProduct: { provider: "google_play", googlePurchaseTokenHash: "old" },
  tokenHash: "new", linkedHash: "old", active: true, source: "rtdn"
}), true, "an active same-product successor can complete a pending replacement through RTDN");
assert.equal(shouldUpdateSubscriptionForPurchase({
  purchase: {}, existingProduct: { provider: "google_play", googlePurchaseTokenHash: "other" },
  tokenHash: "new", linkedHash: "old", active: true, source: "rtdn"
}), false);
assert.equal(shouldUpdateSubscriptionForPurchase({
  purchase: {}, existingProduct: { provider: "google_play", googlePurchaseTokenHash: "old" },
  tokenHash: "new", linkedHash: "old", active: false, source: "rtdn"
}), false);
