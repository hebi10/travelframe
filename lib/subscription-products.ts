import type { UserSubscription, UserSubscriptionProducts } from "@/lib/subscription";

export const emptySubscriptionProducts: UserSubscriptionProducts = {
  adRemove: null,
  creatorMonthly: null,
  expertMonthly: null
};

const isLocalCheckoutEnabled =
  typeof __DEV__ !== "undefined" &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_ENABLE_LOCAL_CHECKOUT === "true";

const isActivePremiumProduct = (
  subscription: UserSubscription | null,
  productId: "ad_remove" | "creator_monthly" | "expert_monthly"
) => {
  const rawProductId = subscription?.productId as string | undefined;
  const normalizedProductId =
    rawProductId === "ad_remove" ||
    rawProductId === "creator_monthly" ||
    rawProductId === "expert_monthly"
      ? rawProductId
      : rawProductId === "premium" ||
          (!rawProductId && subscription?.plan === "premium")
        ? "creator_monthly"
        : "free";

  if (
    !subscription ||
    subscription.plan !== "premium" ||
    subscription.status !== "active" ||
    (subscription.provider === "local_checkout" && !isLocalCheckoutEnabled) ||
    normalizedProductId !== productId
  ) {
    return false;
  }

  if (!subscription.expiresAt) {
    return true;
  }

  return new Date(subscription.expiresAt).getTime() > Date.now();
};

export const getSubscriptionProductsFromSubscription = (
  subscription: UserSubscription | null
): UserSubscriptionProducts => ({
  adRemove: isActivePremiumProduct(subscription, "ad_remove") ? subscription : null,
  creatorMonthly: isActivePremiumProduct(subscription, "creator_monthly")
    ? subscription
    : null,
  expertMonthly: isActivePremiumProduct(subscription, "expert_monthly")
    ? subscription
    : null
});
