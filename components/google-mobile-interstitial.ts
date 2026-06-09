type ShowGoogleMobileInterstitialAdInput = {
  adUnitId: string;
  onComplete: () => void;
};

type InterstitialAdInstance = {
  addAdEventListener: (eventType: string, listener: () => void) => () => void;
  load: () => void;
  show: () => Promise<void> | void;
};

type GoogleMobileAdsInterstitialModule = {
  AdEventType: {
    LOADED: string;
    CLOSED: string;
    ERROR: string;
  };
  InterstitialAd: {
    createForAdRequest: (
      adUnitId: string,
      options: { requestNonPersonalizedAdsOnly: boolean }
    ) => InterstitialAdInstance;
  };
};

const loadGoogleMobileAds = (): GoogleMobileAdsInterstitialModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-google-mobile-ads") as GoogleMobileAdsInterstitialModule;
  } catch {
    return null;
  }
};

export const createGoogleMobileInterstitialAdPresenter =
  (
    loadAds: () => GoogleMobileAdsInterstitialModule | null = loadGoogleMobileAds
  ) =>
  ({ adUnitId, onComplete }: ShowGoogleMobileInterstitialAdInput) => {
    const googleMobileAds = loadAds();

    if (!googleMobileAds) {
      onComplete();
      return () => {};
    }

    const { AdEventType, InterstitialAd } = googleMobileAds;
    let completed = false;
    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true
    });
    const unsubscribers: (() => void)[] = [];

    const cleanup = () => {
      while (unsubscribers.length > 0) {
        unsubscribers.pop()?.();
      }
    };

    const complete = () => {
      if (completed) {
        return;
      }

      completed = true;
      cleanup();
      onComplete();
    };

    unsubscribers.push(
      interstitial.addAdEventListener(AdEventType.LOADED, () => {
        try {
          const result = interstitial.show();
          void Promise.resolve(result).catch(complete);
        } catch {
          complete();
        }
      }),
      interstitial.addAdEventListener(AdEventType.CLOSED, complete),
      interstitial.addAdEventListener(AdEventType.ERROR, complete)
    );

    try {
      interstitial.load();
    } catch {
      complete();
    }

    return () => {
      if (completed) {
        return;
      }

      completed = true;
      cleanup();
    };
  };

export const showGoogleMobileInterstitialAd =
  createGoogleMobileInterstitialAdPresenter();
