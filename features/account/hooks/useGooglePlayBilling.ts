import {
  ErrorCode,
  getAvailablePurchases,
  type ProductSubscription,
  type Purchase,
  useIAP
} from "expo-iap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import type { User } from "firebase/auth";

import {
  GOOGLE_PLAY_ONE_TIME_PRODUCT_IDS,
  GOOGLE_PLAY_PRODUCT_IDS,
  GOOGLE_PLAY_SUBSCRIPTION_IDS,
  getGooglePlayProductType,
  getGooglePlayStorePrice,
  getGooglePlaySubscriptionOfferToken,
  isGooglePlayProductId,
  verifyGooglePlayPurchase,
  type GooglePlayProductId
} from "@/lib/google-play-billing";

type PendingPurchase = {
  productId: GooglePlayProductId;
  resolve: () => void;
  reject: (error: unknown) => void;
};

const purchaseTokenFrom = (purchase: Purchase) =>
  typeof purchase.purchaseToken === "string" && purchase.purchaseToken.length > 0
    ? purchase.purchaseToken
    : null;

export function useGooglePlayBilling({
  user,
  refreshUser
}: {
  user: User | null;
  refreshUser: () => Promise<void>;
}) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const pendingPurchaseRef = useRef<PendingPurchase | null>(null);
  const finishTransactionRef = useRef<
    ((args: { purchase: Purchase; isConsumable?: boolean }) => Promise<void>) | null
  >(null);

  const processVerifiedPurchase = useCallback(
    async (purchase: Purchase) => {
      if (!isGooglePlayProductId(purchase.productId)) {
        return false;
      }

      const purchaseToken = purchaseTokenFrom(purchase);
      if (!purchaseToken) {
        throw new Error("Google Play 구매 토큰을 확인할 수 없습니다.");
      }

      const verification = await verifyGooglePlayPurchase({
        productId: purchase.productId,
        purchaseToken
      });

      if (!verification.verified || !verification.active) {
        throw new Error(
          verification.status === "expired"
            ? "만료된 구매입니다."
            : "Google Play에서 아직 결제가 완료되지 않았습니다."
        );
      }

      await finishTransactionRef.current?.({
        purchase,
        isConsumable: false
      });
      await refreshUser();
      return true;
    },
    [refreshUser]
  );

  const {
    connected,
    products,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void (async () => {
        try {
          await processVerifiedPurchase(purchase);
          const pending = pendingPurchaseRef.current;
          if (pending && pending.productId === purchase.productId) {
            pendingPurchaseRef.current = null;
            pending.resolve();
          }
        } catch (error) {
          const pending = pendingPurchaseRef.current;
          if (pending && pending.productId === purchase.productId) {
            pendingPurchaseRef.current = null;
            pending.reject(error);
          }
          setBillingMessage(
            error instanceof Error ? error.message : "구매를 검증하지 못했습니다."
          );
        }
      })();
    },
    onPurchaseError: (error) => {
      const pending = pendingPurchaseRef.current;
      if (pending) {
        pendingPurchaseRef.current = null;
        pending.reject(error);
      }

      if (error.code !== ErrorCode.UserCancelled) {
        setBillingMessage(error.message || "Google Play 결제를 완료하지 못했습니다.");
      }
    },
    onError: (error) => {
      setBillingMessage(error.message);
    }
  });

  useEffect(() => {
    finishTransactionRef.current = finishTransaction;
  }, [finishTransaction]);

  useEffect(() => {
    if (!connected || Platform.OS !== "android") {
      return;
    }

    void Promise.all([
      fetchProducts({
        skus: [...GOOGLE_PLAY_ONE_TIME_PRODUCT_IDS],
        type: "in-app"
      }),
      fetchProducts({
        skus: [...GOOGLE_PLAY_SUBSCRIPTION_IDS],
        type: "subs"
      })
    ]).catch((error) => {
      setBillingMessage(
        error instanceof Error ? error.message : "Google Play 상품 정보를 불러오지 못했습니다."
      );
    });
  }, [connected, fetchProducts]);

  const subscriptionsById = useMemo(
    () =>
      new Map(
        subscriptions.map((subscription) => [
          subscription.id,
          subscription as ProductSubscription
        ])
      ),
    [subscriptions]
  );

  const purchaseProduct = useCallback(
    async (productId: GooglePlayProductId) => {
      if (Platform.OS !== "android") {
        throw new Error("Google Play 결제는 Android 앱에서만 사용할 수 있습니다.");
      }
      if (!user) {
        throw new Error("로그인 후 결제할 수 있습니다.");
      }
      if (!connected) {
        throw new Error("Google Play 결제 서비스에 연결 중입니다. 잠시 후 다시 시도해 주세요.");
      }
      if (pendingPurchaseRef.current) {
        throw new Error("이미 진행 중인 결제가 있습니다.");
      }

      const type = getGooglePlayProductType(productId);
      let request:
        | {
            type: "in-app";
            request: {
              google: {
                skus: string[];
                obfuscatedAccountId: string;
              };
            };
          }
        | {
            type: "subs";
            request: {
              google: {
                skus: string[];
                subscriptionOffers: { sku: string; offerToken: string }[];
                obfuscatedAccountId: string;
              };
            };
          };

      if (type === "subs") {
        const subscription = subscriptionsById.get(productId);
        const offerToken = getGooglePlaySubscriptionOfferToken(subscription);
        if (!offerToken) {
          throw new Error("Google Play 구독 상품의 구매 옵션을 찾지 못했습니다.");
        }

        request = {
          type: "subs",
          request: {
            google: {
              skus: [productId],
              subscriptionOffers: [{ sku: productId, offerToken }],
              obfuscatedAccountId: user.uid
            }
          }
        };
      } else {
        request = {
          type: "in-app",
          request: {
            google: {
              skus: [productId],
              obfuscatedAccountId: user.uid
            }
          }
        };
      }

      setBillingMessage(null);
      await new Promise<void>((resolve, reject) => {
        pendingPurchaseRef.current = { productId, resolve, reject };
        void requestPurchase(request).catch((error) => {
          if (pendingPurchaseRef.current?.productId === productId) {
            pendingPurchaseRef.current = null;
          }
          reject(error);
        });
      });
    },
    [connected, requestPurchase, subscriptionsById, user]
  );

  const restorePurchases = useCallback(async () => {
    if (Platform.OS !== "android") {
      throw new Error("Google Play 구매 복원은 Android 앱에서만 사용할 수 있습니다.");
    }
    if (!user) {
      throw new Error("로그인 후 구매를 복원할 수 있습니다.");
    }
    if (!connected) {
      throw new Error("Google Play 결제 서비스에 연결 중입니다.");
    }

    setIsRestoring(true);
    setBillingMessage(null);
    try {
      const purchases = await getAvailablePurchases({
        includeSuspendedAndroid: true
      });
      let restoredCount = 0;

      for (const purchase of purchases) {
        if (!isGooglePlayProductId(purchase.productId)) {
          continue;
        }

        try {
          if (await processVerifiedPurchase(purchase)) {
            restoredCount += 1;
          }
        } catch {
          // One stale/expired item must not prevent other valid products from restoring.
        }
      }

      await refreshUser();
      return restoredCount;
    } finally {
      setIsRestoring(false);
    }
  }, [connected, processVerifiedPurchase, refreshUser, user]);

  const getStorePrice = useCallback(
    (productId: GooglePlayProductId) =>
      getGooglePlayStorePrice({
        productId,
        products,
        subscriptions
      }),
    [products, subscriptions]
  );

  return {
    connected,
    billingMessage,
    isRestoring,
    purchaseProduct,
    restorePurchases,
    getStorePrice,
    knownProductIds: GOOGLE_PLAY_PRODUCT_IDS
  };
}
