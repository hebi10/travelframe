import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/lib/auth-context";
import { flushProjectCloudSync, prepareProjectCloudSync } from "@/lib/project-cloud-sync";
import { subscribeProjectCloudSync } from "@/lib/project-cloud-sync-queue";
import { isCreatorSubscriptionActive } from "@/lib/subscription";

export function ProjectCloudSyncBridge() {
  const { user, subscription, subscriptionStatus, isAuthLoading } = useAuth();

  useEffect(() => {
    if (!user || isAuthLoading || subscriptionStatus !== "verified" ||
        !isCreatorSubscriptionActive(subscription)) {
      return;
    }

    let mounted = true;
    const flush = () => {
      if (!mounted || AppState.currentState !== "active") return;
      void flushProjectCloudSync({ user, subscription }).catch(() => undefined);
    };

    const unsubscribe = subscribeProjectCloudSync(flush);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") flush();
    });
    const interval = setInterval(flush, 60_000);

    void prepareProjectCloudSync({ user, subscription })
      .then(flush)
      .catch(() => undefined);

    return () => {
      mounted = false;
      unsubscribe();
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [user, subscription, subscriptionStatus, isAuthLoading]);

  return null;
}
