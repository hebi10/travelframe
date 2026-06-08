import { type ComponentType } from "react";

type GoogleMobileBannerProps = {
  adUnitId: string;
};

type GoogleMobileAdsModule = {
  BannerAd: ComponentType<{
    unitId: string;
    size: string;
    requestOptions: { requestNonPersonalizedAdsOnly: boolean };
  }>;
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: string };
  TestIds: { BANNER: string };
};

const loadGoogleMobileAds = (): GoogleMobileAdsModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-google-mobile-ads") as GoogleMobileAdsModule;
  } catch {
    return null;
  }
};

export function GoogleMobileBanner({ adUnitId }: GoogleMobileBannerProps) {
  const googleMobileAds = loadGoogleMobileAds();

  if (!googleMobileAds) {
    return null;
  }

  const { BannerAd, BannerAdSize, TestIds } = googleMobileAds;
  const unitId = __DEV__ ? TestIds.BANNER : adUnitId;

  return (
    <BannerAd
      unitId={unitId}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
    />
  );
}
