import {
  APP_GUIDE_STEPS,
  APP_GUIDE_VERSION,
  type AppGuideTabKey
} from "@/constants/app-guide-steps";
import { hasStoredAppSettings } from "@/lib/app-settings";
import { localStorageAdapter } from "@/lib/local-storage";

const GUIDE_PROGRESS_KEY = "travel-frame.guide-progress.v1";

export type GuideProgress = {
  seenGuideVersion: number;
  seenIntro: boolean;
  seenTabs: Record<AppGuideTabKey, boolean>;
};

const createEmptySeenTabs = () =>
  Object.keys(APP_GUIDE_STEPS).reduce(
    (seenTabs, tabKey) => ({
      ...seenTabs,
      [tabKey]: false
    }),
    {} as Record<AppGuideTabKey, boolean>
  );

const createCompletedSeenTabs = () =>
  Object.keys(APP_GUIDE_STEPS).reduce(
    (seenTabs, tabKey) => ({
      ...seenTabs,
      [tabKey]: true
    }),
    {} as Record<AppGuideTabKey, boolean>
  );

const normalizeGuideProgress = (value: Partial<GuideProgress> | null): GuideProgress => ({
  seenGuideVersion:
    typeof value?.seenGuideVersion === "number"
      ? value.seenGuideVersion
      : APP_GUIDE_VERSION,
  seenIntro: typeof value?.seenIntro === "boolean" ? value.seenIntro : false,
  seenTabs: {
    ...createEmptySeenTabs(),
    ...(value?.seenTabs ?? {})
  }
});

const saveGuideProgress = async (progress: GuideProgress) => {
  await localStorageAdapter.setItem(GUIDE_PROGRESS_KEY, JSON.stringify(progress));
  return progress;
};

export const getGuideProgress = async () => {
  const stored = await localStorageAdapter.getItem(GUIDE_PROGRESS_KEY);

  if (stored) {
    try {
      const progress = normalizeGuideProgress(JSON.parse(stored) as Partial<GuideProgress>);
      if (progress.seenGuideVersion === APP_GUIDE_VERSION) {
        return progress;
      }

      return saveGuideProgress({
        seenGuideVersion: APP_GUIDE_VERSION,
        seenIntro: false,
        seenTabs: createEmptySeenTabs()
      });
    } catch {
      await localStorageAdapter.removeItem(GUIDE_PROGRESS_KEY);
    }
  }

  if (await hasStoredAppSettings()) {
    return saveGuideProgress({
      seenGuideVersion: APP_GUIDE_VERSION,
      seenIntro: true,
      seenTabs: createCompletedSeenTabs()
    });
  }

  return saveGuideProgress({
    seenGuideVersion: APP_GUIDE_VERSION,
    seenIntro: false,
    seenTabs: createEmptySeenTabs()
  });
};

export const shouldShowGuideForTab = async (tabKey: AppGuideTabKey) => {
  const progress = await getGuideProgress();
  return !progress.seenTabs[tabKey];
};

export const markGuideTabSeen = async (tabKey: AppGuideTabKey) => {
  const progress = await getGuideProgress();
  return saveGuideProgress({
    ...progress,
    seenIntro: tabKey === "home" ? true : progress.seenIntro,
    seenTabs: {
      ...progress.seenTabs,
      [tabKey]: true
    }
  });
};

export const resetAppGuideProgress = async () =>
  saveGuideProgress({
    seenGuideVersion: APP_GUIDE_VERSION,
    seenIntro: false,
    seenTabs: createEmptySeenTabs()
  });
