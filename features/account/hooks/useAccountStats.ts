import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { User } from "firebase/auth";

import { getAppSettings, type StorageMode } from "@/lib/app-settings";
import {
  getUserSubscriptionProducts,
  type UserSubscriptionProducts
} from "@/lib/subscription";
import {
  initialSubscriptionProducts
} from "@/features/account/account-screen.constants";

export function useAccountStats({
  user
}: {
  user: User | null;
}) {
  const [storageMode, setStorageMode] = useState<StorageMode>("local_only");
  const [isSubscriptionProductsLoading, setIsSubscriptionProductsLoading] =
    useState(true);
  const [subscriptionProducts, setSubscriptionProducts] =
    useState<UserSubscriptionProducts>(initialSubscriptionProducts);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsSubscriptionProductsLoading(true);

      const loadAccountState = async () => {
        const [appSettings, nextSubscriptionProducts] = await Promise.all([
          getAppSettings(),
          getUserSubscriptionProducts(user)
        ]);

        if (!isActive) {
          return;
        }

        setStorageMode(appSettings.storageMode);
        setSubscriptionProducts(nextSubscriptionProducts);
        setIsSubscriptionProductsLoading(false);
      };

      loadAccountState().catch(() => {
        if (isActive) {
          setIsSubscriptionProductsLoading(false);
        }
      });

      return () => {
        isActive = false;
      };
    }, [user])
  );

  return {
    storageMode,
    isSubscriptionProductsLoading,
    subscriptionProducts
  };
}
