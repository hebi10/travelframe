"use strict";

const SUBSCRIPTION_ACCESS_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_CANCELED"
]);

const toIsoOrNull = (value) => {
  if (typeof value !== "string" || !value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

const isAcknowledged = (value) =>
  value === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";

const getExternalAccountId = (data) =>
  data?.externalAccountIdentifiers?.obfuscatedExternalAccountId ??
  data?.obfuscatedExternalAccountId ??
  null;

const getSubscriptionLineItem = (data, productId) =>
  Array.isArray(data?.lineItems)
    ? data.lineItems.find((item) => item?.productId === productId) ?? null
    : null;

const getProductLineItem = (data, productId) => {
  const items = data?.productLineItem ?? data?.productLineItems;
  return Array.isArray(items)
    ? items.find((item) => item?.productId === productId) ?? null
    : null;
};

const parseSubscriptionPurchase = ({
  data,
  productId,
  now = Date.now()
}) => {
  const lineItem = getSubscriptionLineItem(data, productId);
  const expiryIso = toIsoOrNull(lineItem?.expiryTime);
  const expiryTime = expiryIso ? new Date(expiryIso).getTime() : 0;
  const googleState = data?.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED";
  const stateGrantsAccess = SUBSCRIPTION_ACCESS_STATES.has(googleState);
  const active = Boolean(lineItem && stateGrantsAccess && expiryTime > now);
  const status = active
    ? "active"
    : googleState === "SUBSCRIPTION_STATE_EXPIRED" || (expiryTime > 0 && expiryTime <= now)
      ? "expired"
      : "inactive";

  return {
    verified: Boolean(lineItem),
    active,
    status,
    googleState,
    productId,
    expiresAt: expiryIso,
    startedAt:
      toIsoOrNull(lineItem?.latestSuccessfulOrderId ? data?.startTime : null) ??
      toIsoOrNull(data?.startTime),
    orderId: lineItem?.latestSuccessfulOrderId ?? null,
    linkedPurchaseToken:
      typeof data?.linkedPurchaseToken === "string" ? data.linkedPurchaseToken : null,
    acknowledgementState: data?.acknowledgementState ?? null,
    acknowledged: isAcknowledged(data?.acknowledgementState),
    externalAccountId: getExternalAccountId(data)
  };
};

const parseOneTimePurchase = ({ data, productId }) => {
  const lineItem = getProductLineItem(data, productId);
  const googleState =
    data?.purchaseStateContext?.purchaseState ??
    data?.purchaseState ??
    "PURCHASE_STATE_UNSPECIFIED";
  const refundableQuantity =
    lineItem?.productOfferDetails?.refundableQuantity;
  const hasRemainingEntitlement =
    refundableQuantity === undefined ||
    refundableQuantity === null ||
    Number(refundableQuantity) > 0;
  const active = Boolean(
    lineItem &&
      googleState === "PURCHASED" &&
      hasRemainingEntitlement
  );

  return {
    verified: Boolean(lineItem),
    active,
    status: active ? "active" : "inactive",
    googleState,
    productId,
    expiresAt: null,
    startedAt: toIsoOrNull(data?.purchaseCompletionTime),
    orderId: data?.orderId ?? null,
    linkedPurchaseToken: null,
    acknowledgementState: data?.acknowledgementState ?? null,
    acknowledged: isAcknowledged(data?.acknowledgementState),
    externalAccountId: getExternalAccountId(data)
  };
};

const isActiveSubscriptionDocument = (subscription, now = Date.now()) => {
  if (
    !subscription ||
    subscription.plan !== "premium" ||
    subscription.status !== "active"
  ) {
    return false;
  }

  if (!subscription.expiresAt) {
    return true;
  }

  return new Date(subscription.expiresAt).getTime() > now;
};

const getEffectiveSubscription = (subscriptions, now = Date.now()) => {
  const expert = isActiveSubscriptionDocument(subscriptions.expert_monthly, now)
    ? subscriptions.expert_monthly
    : null;
  const creator = isActiveSubscriptionDocument(subscriptions.creator_monthly, now)
    ? subscriptions.creator_monthly
    : null;
  const adRemove = isActiveSubscriptionDocument(subscriptions.ad_remove, now)
    ? subscriptions.ad_remove
    : null;

  return expert ?? creator ?? adRemove ?? null;
};

const shouldUpdateSubscriptionForPurchase = ({ purchase, existingProduct, tokenHash, active, source }) => {
  if (purchase?.supersededBy) return false;
  const currentToken = existingProduct?.googlePurchaseTokenHash;
  if (currentToken && currentToken !== tokenHash && (!active || source === "rtdn")) return false;
  return true;
};

module.exports = {
  shouldUpdateSubscriptionForPurchase,
  SUBSCRIPTION_ACCESS_STATES,
  getEffectiveSubscription,
  isActiveSubscriptionDocument,
  parseOneTimePurchase,
  parseSubscriptionPurchase
};
