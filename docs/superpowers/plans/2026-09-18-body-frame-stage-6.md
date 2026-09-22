# Body Frame Stage 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: follow TDD; write/verify RED before production behavior changes.

**Goal:** Replace local checkout with Google Play Billing, server-side purchase verification, Firestore entitlements, purchase restore and RTDN synchronization.

**Architecture:** `expo-iap` handles the Android purchase UI/token acquisition. Firebase Functions verifies tokens against Google Play APIs and is the only writer of Google Play subscription entitlements.

**Spec:** `docs/superpowers/specs/2026-09-18-body-frame-stage-6-design.md`

## Task 1 — Lock Stage 6 contracts
- [x] Add `tests/05-body-frame-stage-6.test.mjs`.
- [x] Assert `expo-iap` dependency/plugin.
- [x] Assert local checkout entitlement path is removed.
- [x] Assert client purchase + restore route through server verification.
- [x] Assert server uses subscriptions v2 + products v2 and acknowledge recovery endpoints.
- [x] Assert purchase-token ownership mapping and RTDN handler exist.
- [x] Assert Firestore blocks client access to billing token maps.
- [x] Open draft PR and verify initial RED at missing `expo-iap 5.6.2`.

## Task 2 — Install/configure Google Play IAP client dependency
- [x] Add `expo-iap@5.6.2` to package.json/package-lock.
- [x] Add `expo-iap` config plugin.
- [x] Keep Android package ID `com.haebi.photoguide` unchanged.

## Task 3 — Add client Google Play billing adapter
- [x] Add fixed product ID/type mapping.
- [x] Fetch one-time + subscription products.
- [x] Resolve Android subscription offer token dynamically.
- [x] Start Play purchase sheet with Firebase uid as obfuscated account id.
- [x] Verify purchase token via Firebase callable.
- [x] Finish transaction only after successful server verification.
- [x] Implement restore using available Google Play purchases.
- [x] Surface localized store price metadata when available.
- [x] Use subscription replacement when upgrading Pro → Expert so both subscriptions are not billed independently.

## Task 4 — Remove local entitlement fulfillment
- [x] Delete/retire `saveLocalCheckoutSubscription`.
- [x] Remove `purchaseProduct` local fulfillment from AuthContext.
- [x] Remove cached-premium-overrides-verified fallback.
- [x] Normalize legacy `local_checkout` cache as non-authoritative/free.
- [x] Keep admin + google_play providers.

## Task 5 — Connect Account purchase UI
- [x] Route purchase buttons to the Google Play billing hook.
- [x] Add Expert store plan.
- [x] Add purchase restore action.
- [x] Refresh Firestore subscription after verified purchase/restore.
- [x] Do not show success until server verification finishes.
- [x] Use localized Play price when available and static copy only as fallback.

## Task 6 — Add server Google Play verifier
- [x] Add Google Android Publisher auth/client helper.
- [x] Verify `ad_remove` with ProductPurchaseV2.
- [x] Verify subscriptions with SubscriptionPurchaseV2.
- [x] Validate expected product/state/expiry and Google package API path.
- [x] Treat fully refunded one-time purchases as inactive.
- [x] Enforce token ownership by SHA-256 token mapping.
- [x] Keep client acknowledgement after server verification and provide server acknowledgement recovery from RTDN/resync.
- [x] Write product/current entitlement documents + payment event atomically.
- [x] Preserve active admin overrides.
- [x] Retire linked/replaced Google Play subscription documents to prevent stale entitlement resurrection.

## Task 7 — Add RTDN synchronization
- [x] Add Pub/Sub handler for `body-frame-play-billing`.
- [x] Resolve owner/product from purchase-token map.
- [x] Follow current subscription RTDN token-only schema.
- [x] Handle one-time product and `voidedPurchaseNotification` events.
- [x] Re-query Google state and update entitlement.
- [x] Record unresolved notifications when no owner mapping exists.
- [x] Never grant entitlement based only on RTDN payload.

## Task 8 — Security/rules/tests
- [x] Explicitly deny client access to server-only Google Play token/notification collections.
- [x] Update old local-checkout tests to the new server-verified contract.
- [x] Add active/canceled/expired/on-hold/refunded purchase policy tests.
- [x] Typecheck PASS.
- [x] Lint PASS.
- [x] Stage 1~6 contracts PASS before known repository baseline failure.
- [x] Account Google Play checkout contract PASS.
- [x] Functions syntax PASS.
- [x] Firebase Rules PASS.
- [x] Confirm existing Android prebuild / historical Secret Scan baseline failures are unchanged.

## Task 9 — Integration status
- [x] Keep PR #6 against `main` until merge requested.
- [x] Document Play Console/IAM/RTDN prerequisites that cannot be performed from source control alone.
- [ ] Perform real Play purchase/renew/cancel/refund tests from an internal/closed Play build after external configuration is complete.

## TDD / verification evidence

### Initial RED
Stage 1~5 contracts passed, then Stage 6 failed before production implementation:

`AssertionError: Stage 6 must pin expo-iap 5.6.2`

### Final code verification
Latest verified code head before this documentation-only completion commit: `e2c1eb4d735d122e149ec9aa0cdeb7a0b0a6a030`.

- TypeScript `tsc --noEmit`: PASS
- Expo lint: PASS
- Stage 1 contract: PASS
- Stage 2 contract: PASS
- Stage 3 contract: PASS
- Stage 4 contract: PASS
- Stage 5 contract: PASS
- Stage 6 contract: PASS — `ok - Body Frame stage 6 Google Play Billing contracts are enforced`
- Account checkout contract: PASS — `ok - account checkout uses server-verified Google Play Billing`
- Functions syntax: PASS
- Firebase Rules: PASS

### Existing repository baseline failures
These are unchanged from Stages 1–5:
- Full `npm test` proceeds past Stage 1–6 and the Account billing test, then stops because `android/app/proguard-rules.pro` is absent.
- Android Kotlin verification stops because `android\\gradlew.bat` is absent and the repository expects Expo prebuild.
- Historical Gitleaks remains red from prior `firebase-debug.log` commits; the latest scan reported the same historical commit/file findings rather than new Stage 6 source secrets.

## External release prerequisites
Source implementation is complete, but a real transaction cannot be proven from CI alone. Before live/internal testing:
1. Create and activate Play products named exactly `ad_remove`, `creator_monthly`, `expert_monthly`.
2. Configure active base plans/offers for the two subscriptions.
3. Enable Android Publisher API access for the deployed Firebase Functions runtime identity and grant the required Play Console permissions.
4. Configure Google Play RTDN to publish to Pub/Sub topic `body-frame-play-billing`.
5. Deploy Functions and Firestore rules.
6. Run a Play internal/closed-test Android build on a physical device and verify purchase, restore, Pro→Expert replacement, renewal, cancellation, expiry and refund/revocation flows.

## Integration status
- Branch: `feat/body-frame-stage-6`
- PR: #6
- Base: `main`
- Not merged until requested.
