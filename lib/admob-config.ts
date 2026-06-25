import Constants from "expo-constants";
import { Platform } from "react-native";

import { initializeNativeAdMob } from "@/lib/admob-native";
import { resolveInterstitialAdUnitId } from "@/lib/admob-units";

type AdMobExtra = {
  androidBannerAdUnitId?: string;
  androidInterstitialAdUnitId?: string;
};

const extra = Constants.expoConfig?.extra as
  | {
      admob?: AdMobExtra;
    }
  | undefined;

export const admobConfig = {
  androidBannerAdUnitId: extra?.admob?.androidBannerAdUnitId ?? null,
  androidInterstitialAdUnitId:
    extra?.admob?.androidInterstitialAdUnitId ?? null
} as const;

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
  if (!canUseNativeAdMob()) {
    return;
  }

  try {
    await initializeNativeAdMob();
  } catch {
    // Expo Go or builds without the native ad module should keep using the local placeholder.
  }
};
