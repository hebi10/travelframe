import { useEffect, useSyncExternalStore } from "react";

import { adConsent } from "@/lib/ad-consent";
import { canUseNativeAdMob, initializeAdMob } from "@/lib/admob-config";

export const useAdConsent = (eligible: boolean) => {
  const snapshot = useSyncExternalStore(
    adConsent.subscribe,
    adConsent.getSnapshot,
    adConsent.getSnapshot
  );

  useEffect(() => {
    if (eligible && canUseNativeAdMob()) {
      void initializeAdMob();
    }
  }, [eligible]);

  return snapshot;
};
