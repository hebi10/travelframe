import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { showGoogleMobileInterstitialAd } from "@/components/google-mobile-interstitial";
import { adConsent } from "@/lib/ad-consent";
import { shouldShowAds } from "@/lib/ad-entitlement";
import { canUseNativeAdMob, getInterstitialAdUnitId } from "@/lib/admob-config";
import { useAuth } from "@/lib/auth-context";
import { useAdConsent } from "@/lib/use-ad-consent";

export const usePostSaveAd = () => {
  const { subscription, subscriptionStatus, isAuthLoading, isLoggedIn } = useAuth();
  const eligible = isLoggedIn && !isAuthLoading && shouldShowAds(subscription, subscriptionStatus);
  const consent = useAdConsent(eligible);
  const eligibleRef = useRef(eligible);
  eligibleRef.current = eligible;
  const focused = useRef(false);
  const cancel = useRef<(() => void) | null>(null);

  const cancelPostSaveAd = useCallback(() => {
    cancel.current?.();
    cancel.current = null;
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => {
      focused.current = false;
      cancelPostSaveAd();
    };
  }, [cancelPostSaveAd]));

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancelPostSaveAd();
    });
    return () => { listener.remove(); cancelPostSaveAd(); };
  }, [cancelPostSaveAd]);

  useEffect(() => {
    if (!eligible || !consent.canRequestAds) cancelPostSaveAd();
  }, [cancelPostSaveAd, consent.canRequestAds, eligible]);

  const requestPostSaveAd = useCallback(() => {
    cancelPostSaveAd();
    const canShow = () => focused.current &&
      AppState.currentState === "active" &&
      eligibleRef.current &&
      adConsent.getSnapshot().canRequestAds;
    if (!canUseNativeAdMob() || !canShow()) return;
    const adUnitId = getInterstitialAdUnitId();
    if (!adUnitId) return;
    try {
      cancel.current = showGoogleMobileInterstitialAd({
        adUnitId,
        canShow,
        onComplete: () => {}
      });
    } catch {
      cancel.current = null;
    }
  }, [cancelPostSaveAd]);

  return { requestPostSaveAd, cancelPostSaveAd };
};
