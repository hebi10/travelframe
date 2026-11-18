import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";

import { showGoogleMobileRewardedAd, type RewardedFeatureAdOutcome } from "@/lib/rewarded-feature-ad";
import { adConsent } from "@/lib/ad-consent";
import { shouldShowAds } from "@/lib/ad-entitlement";
import { canUseNativeAdMob, getRewardedAdUnitId } from "@/lib/admob-config";
import { useAuth } from "@/lib/auth-context";
import { useAdConsent } from "@/lib/use-ad-consent";

export const useRewardedFeatureAd = () => {
  const { isLoggedIn, isAuthLoading, subscription, subscriptionStatus } = useAuth();
  const eligible = isLoggedIn && !isAuthLoading && shouldShowAds(subscription, subscriptionStatus);
  const consent = useAdConsent(eligible);
  const focusedRef = useRef(false);
  const eligibleRef = useRef(eligible);
  const inFlightRef = useRef(false);
  const cancelRef = useRef<(() => void) | null>(null);
  eligibleRef.current = eligible;

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    return () => {
      focusedRef.current = false;
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, []));

  useEffect(() => {
    if (!eligible || !consent.canRequestAds) {
      cancelRef.current?.();
      cancelRef.current = null;
    }
  }, [consent.canRequestAds, eligible]);

  const requestRewardedFeatureAd = useCallback(async (actionLabel: string): Promise<boolean> => {
    if (inFlightRef.current) return false;
    if (!eligibleRef.current) return true;
    if (!canUseNativeAdMob() || !adConsent.getSnapshot().canRequestAds) return true;
    const adUnitId = getRewardedAdUnitId();
    if (!adUnitId) return true;

    inFlightRef.current = true;
    try {
      const accepted = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        Alert.alert(
          "광고 시청 안내",
          "무료 이용자는 " + actionLabel + " 전에 광고를 시청합니다. 광고를 완료하면 작업을 시작합니다. 광고 길이는 광고마다 다릅니다.",
          [
            { text: "취소", style: "cancel", onPress: () => finish(false) },
            { text: "광고 보기", onPress: () => finish(true) }
          ],
          { cancelable: true, onDismiss: () => finish(false) }
        );
      });
      if (!accepted || !focusedRef.current || !eligibleRef.current ||
          !adConsent.getSnapshot().canRequestAds) return false;

      const outcome = await new Promise<RewardedFeatureAdOutcome>((resolve) => {
        cancelRef.current = showGoogleMobileRewardedAd({
          adUnitId,
          canShow: () => focusedRef.current &&
            eligibleRef.current &&
            adConsent.getSnapshot().canRequestAds,
          onComplete: resolve
        });
      });
      cancelRef.current = null;

      // A missing fill or SDK error must not permanently block an offline video export.
      return focusedRef.current && (outcome === "earned" || outcome === "unavailable");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  return { requestRewardedFeatureAd };
};
