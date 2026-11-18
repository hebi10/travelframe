export type RewardedFeatureAdOutcome = "earned" | "dismissed" | "unavailable" | "cancelled";

type ShowRewardedAdInput = {
  adUnitId: string;
  canShow: () => boolean;
  onComplete: (result: RewardedFeatureAdOutcome) => void;
};

type RewardedAdInstance = {
  addAdEventListener: (eventType: string, listener: () => void) => () => void;
  load: () => void;
  show: () => Promise<void> | void;
};

type GoogleMobileAdsRewardedModule = {
  AdEventType: { CLOSED: string; ERROR: string };
  RewardedAdEventType: { LOADED: string; EARNED_REWARD: string };
  RewardedAd: {
    createForAdRequest: (
      adUnitId: string,
      options: { requestNonPersonalizedAdsOnly: boolean }
    ) => RewardedAdInstance;
  };
};

const loadGoogleMobileAds = (): GoogleMobileAdsRewardedModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-google-mobile-ads") as GoogleMobileAdsRewardedModule;
  } catch {
    return null;
  }
};

export const REWARDED_AD_LOAD_TIMEOUT_MS = 8_000;

export const createGoogleMobileRewardedAdPresenter = (
  loadAds: () => GoogleMobileAdsRewardedModule | null = loadGoogleMobileAds
) => {
  let busy = false;

  return ({ adUnitId, canShow, onComplete }: ShowRewardedAdInput) => {
    if (busy || !canShow()) {
      onComplete(busy ? "cancelled" : "unavailable");
      return () => {};
    }

    busy = true;
    let finished = false;
    let earned = false;
    let showing = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const unsubscribers: (() => void)[] = [];

    const cleanup = () => {
      if (timeout !== undefined) clearTimeout(timeout);
      timeout = undefined;
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
      busy = false;
    };
    const complete = (result: RewardedFeatureAdOutcome) => {
      if (finished) return;
      finished = true;
      cleanup();
      onComplete(result);
    };

    try {
      const ads = loadAds();
      if (!ads) {
        complete("unavailable");
        return () => {};
      }
      const rewarded = ads.RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true
      });
      unsubscribers.push(
        rewarded.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
          if (finished || showing) return;
          if (!canShow()) {
            complete("cancelled");
            return;
          }
          showing = true;
          if (timeout !== undefined) clearTimeout(timeout);
          timeout = undefined;
          void Promise.resolve().then(() => rewarded.show()).catch(() => complete("unavailable"));
        }),
        rewarded.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
          if (!finished) earned = true;
        }),
        rewarded.addAdEventListener(ads.AdEventType.CLOSED, () => {
          complete(earned ? "earned" : "dismissed");
        }),
        rewarded.addAdEventListener(ads.AdEventType.ERROR, () => complete("unavailable"))
      );
      timeout = setTimeout(() => complete("unavailable"), REWARDED_AD_LOAD_TIMEOUT_MS);
      rewarded.load();
    } catch {
      complete("unavailable");
    }

    return () => complete("cancelled");
  };
};

export const showGoogleMobileRewardedAd = createGoogleMobileRewardedAdPresenter();
