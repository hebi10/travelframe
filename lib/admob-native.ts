type MobileAdsInitializer = {
  initialize: () => Promise<void> | void;
};

type MobileAdsFactory = () => MobileAdsInitializer;

const loadMobileAds = (): MobileAdsFactory | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("react-native-google-mobile-ads") as
      | { default?: MobileAdsFactory }
      | MobileAdsFactory;

    return typeof module === "function" ? module : module.default ?? null;
  } catch {
    return null;
  }
};

export const createNativeAdMobInitializer =
  (loadAds: () => MobileAdsFactory | null = loadMobileAds) => async () => {
    const mobileAds = loadAds();

    if (!mobileAds) {
      return;
    }

    await mobileAds().initialize();
  };

export const initializeNativeAdMob = createNativeAdMobInitializer();
