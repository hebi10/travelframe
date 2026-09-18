import { httpsCallable } from "firebase/functions";
import type { Product, ProductSubscription } from "expo-iap";

import { firebaseFunctions } from "@/lib/firebase";
import type { SubscriptionProductId } from "@/lib/subscription";

export const GOOGLE_PLAY_PACKAGE_NAME = "com.haebi.photoguide";

export type GooglePlayProductId = Exclude<SubscriptionProductId, "free">;

export const GOOGLE_PLAY_ONE_TIME_PRODUCT_IDS = ["ad_remove"] as const;
export const GOOGLE_PLAY_SUBSCRIPTION_IDS = [
  "creator_monthly",
  "expert_monthly"
] as const;
export const GOOGLE_PLAY_PRODUCT_IDS: GooglePlayProductId[] = [
  ...GOOGLE_PLAY_ONE_TIME_PRODUCT_IDS,
  ...GOOGLE_PLAY_SUBSCRIPTION_IDS
];

export const isGooglePlayProductId = (
  value: string
): value is GooglePlayProductId =>
  GOOGLE_PLAY_PRODUCT_IDS.includes(value as GooglePlayProductId);

export const getGooglePlayProductType = (
  productId: GooglePlayProductId
): "in-app" | "subs" =>
  productId === "ad_remove" ? "in-app" : "subs";

export const getGooglePlaySubscriptionOfferToken = (
  subscription: ProductSubscription | undefined
) => {
  if (!subscription || subscription.platform !== "android") {
    return null;
  }

  return (
    subscription.subscriptionOffers.find(
      (offer) =>
        typeof offer.offerTokenAndroid === "string" &&
        offer.offerTokenAndroid.length > 0
    )?.offerTokenAndroid ?? null
  );
};

export const getGooglePlayStorePrice = ({
  productId,
  products,
  subscriptions
}: {
  productId: GooglePlayProductId;
  products: Product[];
  subscriptions: ProductSubscription[];
}) => {
  if (getGooglePlayProductType(productId) === "in-app") {
    return products.find((product) => product.id === productId)?.displayPrice ?? null;
  }

  const subscription = subscriptions.find((item) => item.id === productId);
  if (!subscription) {
    return null;
  }

  if (subscription.platform === "android") {
    const regularOffer =
      subscription.subscriptionOffers.find(
        (offer) =>
          offer.offerTokenAndroid &&
          offer.pricingPhasesAndroid?.pricingPhaseList?.length
      ) ?? subscription.subscriptionOffers[0];

    const phases = regularOffer?.pricingPhasesAndroid?.pricingPhaseList ?? [];
    const recurringPhase = [...phases].reverse().find((phase) => phase.formattedPrice);
    return recurringPhase?.formattedPrice ?? regularOffer?.displayPrice ?? subscription.displayPrice;
  }

  return subscription.displayPrice;
};

type VerifyGooglePlayPurchaseRequest = {
  productId: GooglePlayProductId;
  purchaseToken: string;
};

export type VerifyGooglePlayPurchaseResponse = {
  verified: boolean;
  active: boolean;
  productId: GooglePlayProductId;
  status: "active" | "inactive" | "expired";
  expiresAt: string | null;
  acknowledgementState: string | null;
};

export const verifyGooglePlayPurchase = async (
  request: VerifyGooglePlayPurchaseRequest
): Promise<VerifyGooglePlayPurchaseResponse> => {
  if (!firebaseFunctions) {
    throw new Error("결제 검증 서버에 연결할 수 없습니다.");
  }

  if (!request.purchaseToken) {
    throw new Error("Google Play 구매 토큰을 확인할 수 없습니다.");
  }

  const callable = httpsCallable<
    VerifyGooglePlayPurchaseRequest,
    VerifyGooglePlayPurchaseResponse
  >(firebaseFunctions, "verifyGooglePlayPurchase");
  const response = await callable(request);
  return response.data;
};
