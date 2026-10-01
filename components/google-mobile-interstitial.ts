type ShowGoogleMobileInterstitialAdInput = {
  adUnitId: string;
  onComplete: () => void;
  canShow?: () => boolean;
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

export const INTERSTITIAL_LOAD_TIMEOUT_MS = 3_000;
export const INTERSTITIAL_MIN_INTERVAL_MS = 120_000;

export const createGoogleMobileInterstitialAdPresenter = (
  loadAds: () => GoogleMobileAdsInterstitialModule | null = loadGoogleMobileAds
) => {
  let busy = false;
  let lastShownAt = -Infinity;

  return ({ adUnitId, onComplete, canShow = () => true }: ShowGoogleMobileInterstitialAdInput) => {
    if (busy || Date.now() - lastShownAt < INTERSTITIAL_MIN_INTERVAL_MS || !canShow()) {
      onComplete();
      return () => {};
    }

    let completed = false;
    let cancelled = false;
    let showing = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const unsubscribers: (() => void)[] = [];
    busy = true;

    const cleanup = () => {
      if (timeout !== undefined) clearTimeout(timeout);
      while (unsubscribers.length > 0) {
        try { unsubscribers.pop()?.(); } catch { continue; }
      }
    };
    const complete = () => {
      if (completed) return;
      completed = true;
      cleanup();
      busy = false;
      if (!cancelled) onComplete();
    };

    try {
      const googleMobileAds = loadAds();
      if (!googleMobileAds) {
        complete();
        return () => {};
      }
      const { AdEventType, InterstitialAd } = googleMobileAds;
      const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true
      });
      unsubscribers.push(
        interstitial.addAdEventListener(AdEventType.LOADED, () => {
          if (completed || cancelled || showing) return;
          try {
            if (!canShow()) {
              complete();
              return;
            }
            showing = true;
            if (timeout !== undefined) clearTimeout(timeout);
            lastShownAt = Date.now();
            void Promise.resolve(interstitial.show()).catch(complete);
          } catch {
            complete();
          }
        }),
        interstitial.addAdEventListener(AdEventType.CLOSED, complete),
        interstitial.addAdEventListener(AdEventType.ERROR, complete)
      );
      timeout = setTimeout(complete, INTERSTITIAL_LOAD_TIMEOUT_MS);
      interstitial.load();
    } catch {
      complete();
    }

    return () => {
      if (completed) return;
      cancelled = true;
      if (!showing) {
        completed = true;
        cleanup();
        busy = false;
      }
    };
  };
};

export const showGoogleMobileInterstitialAd =
  createGoogleMobileInterstitialAdPresenter();
