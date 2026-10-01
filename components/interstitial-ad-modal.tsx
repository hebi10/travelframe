import { useEffect, useRef } from "react";

import { showGoogleMobileInterstitialAd } from "@/components/google-mobile-interstitial";
import { type AdPlacement, shouldShowAds } from "@/lib/ad-entitlement";
import { canUseNativeAdMob, getInterstitialAdUnitId } from "@/lib/admob-config";
import { useAuth } from "@/lib/auth-context";

type InterstitialAdModalProps = {
  visible: boolean;
  placement: AdPlacement;
  onClose: () => void;
};

export function InterstitialAdModal({
  visible,
  onClose
}: InterstitialAdModalProps) {
  const { subscription, subscriptionStatus, isAuthLoading, isLoggedIn } = useAuth();
  const onCloseRef = useRef(onClose);
  const requestIdRef = useRef(0);
  const canShowAds = isLoggedIn && !isAuthLoading && shouldShowAds(subscription, subscriptionStatus);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      requestIdRef.current += 1;
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const finish = () => {
      if (requestIdRef.current !== requestId) {
        return;
      }

      onCloseRef.current();
    };

    if (!canShowAds) {
      finish();
      return;
    }

    const adUnitId = getInterstitialAdUnitId();
    if (!canUseNativeAdMob() || !adUnitId) {
      finish();
      return;
    }

    return showGoogleMobileInterstitialAd({
      adUnitId,
      onComplete: finish
    });
  }, [canShowAds, visible]);

  return null;
}
