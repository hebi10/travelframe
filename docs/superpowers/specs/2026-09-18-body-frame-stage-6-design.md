# Body Frame Stage 6 Design

## Goal
Replace the temporary local checkout with real Google Play Billing on Android, and make server-verified Google Play state the only authority that can grant or revoke paid entitlements.

## Fixed product mapping
- Android package: `com.haebi.photoguide`
- `ad_remove`: Google Play one-time, non-consumable product
- `creator_monthly`: Google Play subscription
- `expert_monthly`: Google Play subscription
- Existing Firestore subscription document IDs remain unchanged for backward compatibility.
- Existing admin-granted subscriptions remain supported.

## Client billing stack
Use `expo-iap` in the Android custom/dev/release build.

The client is responsible only for:
1. connecting to Google Play Billing,
2. loading store products/offers,
3. opening the Play purchase sheet,
4. receiving the purchase token,
5. sending the product ID + purchase token to Firebase Functions,
6. finishing/acknowledging the local transaction only after server verification succeeds,
7. refreshing the server-backed subscription state.

The client must never create an active paid subscription locally.

## Server verification
Firebase Functions owns entitlement fulfillment.

### One-time product
Verify `ad_remove` with Google Play Developer API `purchases.productsv2.getproductpurchasev2`.
- Require PURCHASED state.
- Require the returned product line item to match `ad_remove`.
- Acknowledge if Google reports the purchase is not acknowledged.
- Persist the verified result as provider `google_play`.

### Subscriptions
Verify `creator_monthly` and `expert_monthly` with `purchases.subscriptionsv2.get`.
- Require a line item matching the requested product.
- Access is active only for an access-granting Google state and a non-expired line item.
- Canceled subscriptions remain active only until their current expiry.
- Expired, pending, paused/on-hold states do not grant entitlement.
- Acknowledge an unacknowledged initial purchase.
- Linked purchase tokens are tracked so upgrades/replacements cannot leave duplicate stale ownership.

## Purchase-token ownership
Purchase tokens are server-only.

Create `googlePlayPurchases/{sha256(purchaseToken)}` documents containing:
- owner uid
- product ID
- package name
- provider
- current Google state
- purchase token (server-only; never exposed by Firestore rules)
- order ID when available
- expiry time when available
- linked purchase token hash when available
- acknowledgement state
- updated timestamp

If a token was previously verified for another uid, verification must fail.

## Firestore entitlement model
Continue using:
- `users/{uid}/subscriptions/ad_remove`
- `users/{uid}/subscriptions/creator_monthly`
- `users/{uid}/subscriptions/expert_monthly`
- `users/{uid}/subscriptions/current`
- `users/{uid}/paymentEvents/{eventId}`

Google Play verification writes product documents with:
- `provider: "google_play"`
- `plan: "premium"` for active paid access
- `status: "active" | "expired" | "inactive"`
- product ID/name
- start/payment/expiry metadata
- Google state metadata

`current` keeps the existing precedence:
Expert > Pro > Ad Remove > Free.

Admin-granted subscriptions continue to work. Google Play refresh must not revoke a currently active admin grant merely because a Play purchase expired.

## RTDN
Add a Pub/Sub-triggered Firebase Function for Google Play Real-time Developer Notifications.

Topic contract:
- expected topic name: `google-play-billing`

The RTDN handler:
1. validates package name,
2. reads the purchase token/product from the notification,
3. finds the existing server-only purchase-token owner mapping,
4. re-queries Google Play instead of trusting the notification type,
5. rewrites the Firestore entitlement to the current verified state,
6. records a payment event.

Renewal, cancellation, expiration, grace-period changes, hold/restore, revocation and refund therefore converge through the same verifier.

If an RTDN token has never been associated with an app user, store an unresolved server-only notification record instead of guessing an owner.

## Restore purchases
The Account screen exposes a purchase-restore action.

Restore flow:
1. client asks Google Play for available purchases,
2. recognized Body Frame product IDs are sent one-by-one to the same server verifier,
3. server verifies token ownership/state,
4. client finishes eligible verified transactions,
5. app refreshes Firestore subscription state.

## Subscription authority and offline behavior
Remove the temporary local checkout path.

- Firestore verified state is the entitlement authority.
- A cached subscription can be displayed when verification is temporarily unavailable, but it must not be promoted over a verified free/expired server state.
- Stale legacy `local_checkout` cache values must normalize to non-authoritative/free behavior.
- `hasFullAccess` continues to require verified subscription status.

## Store metadata
The Account purchase UI may use Google Play's localized title/price when available. Existing static labels remain only as fallback display copy and must not determine entitlement.

For Android subscription purchase requests, use an offer token returned by the subscription details. Do not hard-code a base-plan offer token in source.

## Security
- Firestore clients cannot write `subscriptions`, `paymentEvents`, `googlePlayPurchases`, or unresolved billing notification records.
- Purchase tokens are never written by the client to Firestore.
- A verified purchase token cannot be claimed by another Firebase uid.
- Server verification checks the Android package name and expected product ID.
- Successful client purchase UI must not report completion until server verification succeeds.
- Google Play service credentials stay in the server runtime / Google Cloud IAM, never in the app bundle.

## Compatibility
- Existing admin subscriptions remain valid.
- Existing Firestore product IDs remain unchanged.
- Existing Stage 5 entitlement limits continue to consume `getPlanEntitlements()`; no Stage 5 policy rewrite is required.
- Do not change Android package ID.
- Do not implement Stage 7 final branding/settings redesign here.
- No iOS StoreKit work in Stage 6.

## External release prerequisites
Code completion is separate from Play Console configuration. Before a live purchase can succeed:
- create/activate the three matching Play Console products,
- configure subscription base plans/offers,
- enable Android Publisher API access for the Firebase Functions runtime identity,
- configure Google Play RTDN to publish to `google-play-billing`,
- deploy Functions/rules,
- test through a Play internal/closed test build on a physical Android device.

These are deployment/configuration prerequisites, not reasons to retain local checkout fallback.
