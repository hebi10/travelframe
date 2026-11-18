import Constants from "expo-constants";
import { Platform } from "react-native";

import { adConsent } from "@/lib/ad-consent";
import { resolveInterstitialAdUnitId, resolveRewardedAdUnitId } from "@/lib/admob-units";

type AdMobExtra = {
  androidAppId?: string;
  androidBannerAdUnitId?: string;
  androidInterstitialAdUnitId?: string;
  androidRewardedAdUnitId?: string;
};

const extra = Constants.expoConfig?.extra as
  | {
      admob?: AdMobExtra;
    }
  | undefined;

export const admobConfig = {
  androidAppId:
    extra?.admob?.androidAppId ?? "ca-app-pub-3239289311207399~9959086380",
  androidBannerAdUnitId:
    extra?.admob?.androidBannerAdUnitId ?? "ca-app-pub-3239289311207399/3281997392",
  androidInterstitialAdUnitId:
    extra?.admob?.androidInterstitialAdUnitId ?? null,
  androidRewardedAdUnitId: extra?.admob?.androidRewardedAdUnitId ?? null
} as const;

export const getRewardedAdUnitId = () =>
  resolveRewardedAdUnitId({
    isAndroid: Platform.OS === "android",
    isDev: __DEV__,
    androidRewardedAdUnitId: admobConfig.androidRewardedAdUnitId
  });

export const getBannerAdUnitId = () =>
  Platform.OS === "android" ? admobConfig.androidBannerAdUnitId : null;

export const getInterstitialAdUnitId = () =>
  resolveInterstitialAdUnitId({
    isAndroid: Platform.OS === "android",
    isDev: __DEV__,
    androidInterstitialAdUnitId: admobConfig.androidInterstitialAdUnitId
  });

export const isAdMobConfigured = () =>
  Platform.OS === "android" && Boolean(admobConfig.androidBannerAdUnitId);

export const isInterstitialAdMobConfigured = () =>
  Platform.OS === "android" && Boolean(getInterstitialAdUnitId());

export const canUseNativeAdMob = () =>
  Platform.OS === "android" && Constants.appOwnership !== "expo";

export const initializeAdMob = async () => {
  if (!canUseNativeAdMob()) return false;
  return adConsent.prepareAds();
};
