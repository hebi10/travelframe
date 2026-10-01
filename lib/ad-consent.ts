import { initializeNativeAdMob } from "@/lib/admob-native";

type ConsentInfo = {
  canRequestAds: boolean;
  privacyOptionsRequirementStatus?: string;
};

type ConsentApi = {
  gatherConsent: () => Promise<ConsentInfo>;
  getConsentInfo: () => Promise<ConsentInfo>;
  requestInfoUpdate?: () => Promise<ConsentInfo>;
  showPrivacyOptionsForm: () => Promise<unknown>;
};

export type AdConsentSnapshot = {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  isBusy: boolean;
};

const loadConsent = (): ConsentApi | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("react-native-google-mobile-ads") as { AdsConsent?: ConsentApi };
    return module.AdsConsent ?? null;
  } catch {
    return null;
  }
};

export const createAdConsentController = (
  load: () => ConsentApi | null = loadConsent,
  initialize: () => Promise<void> = initializeNativeAdMob
) => {
  let snapshot: AdConsentSnapshot = {
    canRequestAds: false,
    privacyOptionsRequired: false,
    isBusy: false
  };
  let initialized = false;
  let prepared = false;
  let preparing: Promise<boolean> | null = null;
  let privacyOperation: Promise<void> | null = null;
  let changingPrivacy = false;
  const listeners = new Set<() => void>();

  const publish = (patch: Partial<AdConsentSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };

  const prepareAds = (): Promise<boolean> => {
    if (changingPrivacy) return Promise.resolve(false);
    if (preparing) return preparing;
    if (prepared) return Promise.resolve(snapshot.canRequestAds);
    publish({ canRequestAds: false, isBusy: true });
    preparing = Promise.resolve().then(async () => {
      try {
        const api = load();
        if (!api) return false;
        let info: ConsentInfo;
        try {
          info = await api.gatherConsent();
        } catch {
          info = await api.getConsentInfo();
        }
        publish({ privacyOptionsRequired: info.privacyOptionsRequirementStatus === "REQUIRED" });
        if (info.canRequestAds && !initialized && !changingPrivacy) {
          await initialize();
          initialized = true;
        }
        prepared = true;
        const allowed = info.canRequestAds && initialized && !changingPrivacy;
        publish({ canRequestAds: allowed });
        return allowed;
      } catch {
        publish({ canRequestAds: false });
        return false;
      } finally {
        preparing = null;
        if (!changingPrivacy) publish({ isBusy: false });
      }
    });
    return preparing;
  };

  const inspectPrivacyOptions = async () => {
    try {
      if (preparing) await preparing;
      if (changingPrivacy) return;
      const api = load();
      if (!api) return;
      const info = !prepared && api.requestInfoUpdate
        ? await api.requestInfoUpdate()
        : await api.getConsentInfo();
      if (!changingPrivacy) {
        publish({ privacyOptionsRequired: info.privacyOptionsRequirementStatus === "REQUIRED" });
      }
    } catch {
      // Keep the last known entry point; a read failure must not authorize ads.
    }
  };

  const showPrivacyOptions = (): Promise<void> => {
    if (privacyOperation) return privacyOperation;
    changingPrivacy = true;
    publish({ canRequestAds: false, isBusy: true });
    const previousPreparation = preparing;
    privacyOperation = Promise.resolve().then(async () => {
      try {
        await previousPreparation;
        const api = load();
        if (!api) throw new Error("광고 개인정보 설정을 사용할 수 없습니다.");
        const before = await api.getConsentInfo();
        if (before.privacyOptionsRequirementStatus === "REQUIRED") {
          await api.showPrivacyOptionsForm();
        }
        const after = await api.getConsentInfo();
        prepared = initialized;
        publish({
          canRequestAds: after.canRequestAds && initialized,
          privacyOptionsRequired: after.privacyOptionsRequirementStatus === "REQUIRED"
        });
      } catch {
        prepared = false;
        publish({ canRequestAds: false });
        throw new Error("광고 개인정보 설정을 불러오지 못했습니다. 연결 상태를 확인해 주세요.");
      } finally {
        changingPrivacy = false;
        privacyOperation = null;
        publish({ isBusy: false });
      }
    });
    return privacyOperation;
  };

  return {
    prepareAds,
    inspectPrivacyOptions,
    showPrivacyOptions,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
};

export const adConsent = createAdConsentController();
