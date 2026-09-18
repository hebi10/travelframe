# Body Frame Stage 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: follow TDD; write/verify RED before production behavior changes.

**Goal:** Replace local checkout with Google Play Billing, server-side purchase verification, Firestore entitlements, purchase restore and RTDN synchronization.

**Architecture:** `expo-iap` handles the Android purchase UI/token acquisition. Firebase Functions verifies tokens against Google Play APIs and is the only writer of Google Play subscription entitlements.

**Spec:** `docs/superpowers/specs/2026-09-18-body-frame-stage-6-design.md`

## Task 1 — Lock Stage 6 contracts
- [ ] Add `tests/05-body-frame-stage-6.test.mjs`.
- [ ] Assert `expo-iap` dependency/plugin.
- [ ] Assert local checkout entitlement path is removed.
- [ ] Assert client purchase + restore route through server verification.
- [ ] Assert server uses subscriptions v2 + products v2 and acknowledge endpoints.
- [ ] Assert purchase-token ownership mapping and RTDN handler exist.
- [ ] Assert Firestore blocks client access to billing token maps.
- [ ] Open draft PR and verify RED.

## Task 2 — Install/configure Google Play IAP client dependency
- [ ] Add `expo-iap` to package.json/package-lock.
- [ ] Add `expo-iap` config plugin.
- [ ] Keep Android package ID unchanged.

## Task 3 — Add client Google Play billing adapter
- [ ] Add fixed product ID/type mapping.
- [ ] Fetch one-time + subscription products.
- [ ] Resolve Android subscription offer token dynamically.
- [ ] Start Play purchase sheet with Firebase uid as obfuscated account id.
- [ ] Verify purchase token via Firebase callable.
- [ ] Finish transaction only after successful server verification.
- [ ] Implement restore using available Google Play purchases.
- [ ] Surface localized store price metadata when available.

## Task 4 — Remove local entitlement fulfillment
- [ ] Delete/retire `saveLocalCheckoutSubscription`.
- [ ] Remove `purchaseProduct` local fulfillment from AuthContext.
- [ ] Remove cached-premium-overrides-verified fallback.
- [ ] Normalize legacy `local_checkout` cache as non-authoritative.
- [ ] Keep admin + google_play providers.

## Task 5 — Connect Account purchase UI
- [ ] Route purchase buttons to the Google Play billing hook.
- [ ] Add purchase restore action.
- [ ] Refresh Firestore subscription after verified purchase/restore.
- [ ] Do not show success until server verification finishes.

## Task 6 — Add server Google Play verifier
- [ ] Add Google Android Publisher auth/client helper.
- [ ] Verify `ad_remove` with ProductPurchaseV2.
- [ ] Verify subscriptions with SubscriptionPurchaseV2.
- [ ] Validate package/product/state/expiry.
- [ ] Enforce token ownership by SHA-256 token mapping.
- [ ] Acknowledge verified unacknowledged purchases.
- [ ] Write product/current entitlement documents + payment event atomically.
- [ ] Preserve active admin overrides.

## Task 7 — Add RTDN synchronization
- [ ] Add Pub/Sub handler for `google-play-billing`.
- [ ] Resolve owner from purchase-token map.
- [ ] Re-query Google state and update entitlement.
- [ ] Record unresolved notifications when no owner mapping exists.
- [ ] Never grant entitlement based only on RTDN payload.

## Task 8 — Security/rules/tests
- [ ] Explicitly deny client access to server-only Google Play token/notification collections.
- [ ] Update old local-checkout tests to the new server-verified contract.
- [ ] Typecheck PASS.
- [ ] Lint PASS.
- [ ] Stage 1~6 contracts PASS before known repository baseline failure.
- [ ] Functions syntax PASS.
- [ ] Firebase Rules PASS.
- [ ] Confirm existing Android prebuild / historical Secret Scan baseline failures are unchanged.

## Task 9 — Integration status
- [ ] Keep PR against `main` until merge requested.
- [ ] Document Play Console/IAM/RTDN prerequisites that cannot be performed from source control alone.
