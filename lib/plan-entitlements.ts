import type { UserSubscription } from "@/lib/subscription";

export type PlanTier = "guest" | "free" | "ad_remove" | "pro" | "expert";

export type PlanEntitlements = {
  tier: PlanTier;
  label: string;
  canExportVideo: boolean;
  weeklyVideoExportLimit: number;
  showAds: boolean;
  showWatermark: boolean;
  canUseAdvancedOutput: boolean;
  canBackupToCloud: boolean;
  localImageLimit: number;
  localVideoLimit: number;
  musicTrackLimit: number;
  backupStorageBytes: number;
};

export const GIB = 1024 * 1024 * 1024;

export const PLAN_ENTITLEMENTS: Record<PlanTier, PlanEntitlements> = {
  guest: {
    tier: "guest",
    label: "비로그인",
    canExportVideo: false,
    weeklyVideoExportLimit: 0,
    showAds: false,
    showWatermark: true,
    canUseAdvancedOutput: false,
    canBackupToCloud: false,
    localImageLimit: 0,
    localVideoLimit: 0,
    musicTrackLimit: 0,
    backupStorageBytes: 0
  },
  free: {
    tier: "free",
    label: "무료",
    canExportVideo: true,
    weeklyVideoExportLimit: 1,
    showAds: true,
    showWatermark: true,
    canUseAdvancedOutput: false,
    canBackupToCloud: false,
    localImageLimit: 100,
    localVideoLimit: 30,
    musicTrackLimit: 0,
    backupStorageBytes: 0
  },
  ad_remove: {
    tier: "ad_remove",
    label: "광고 제거",
    canExportVideo: true,
    weeklyVideoExportLimit: 1,
    showAds: false,
    showWatermark: true,
    canUseAdvancedOutput: false,
    canBackupToCloud: false,
    localImageLimit: 100,
    localVideoLimit: 30,
    musicTrackLimit: 0,
    backupStorageBytes: 0
  },
  pro: {
    tier: "pro",
    label: "Pro",
    canExportVideo: true,
    weeklyVideoExportLimit: 15,
    showAds: false,
    showWatermark: false,
    canUseAdvancedOutput: true,
    canBackupToCloud: true,
    localImageLimit: 200,
    localVideoLimit: 50,
    musicTrackLimit: 10,
    backupStorageBytes: 2 * GIB
  },
  expert: {
    tier: "expert",
    label: "전문가",
    canExportVideo: true,
    weeklyVideoExportLimit: 30,
    showAds: false,
    showWatermark: false,
    canUseAdvancedOutput: true,
    canBackupToCloud: true,
    localImageLimit: 300,
    localVideoLimit: 100,
    musicTrackLimit: 20,
    backupStorageBytes: 5 * GIB
  }
};

const isActivePremiumProduct = (
  subscription: UserSubscription | null,
  productId: string
) => {
  if (
    !subscription ||
    subscription.plan !== "premium" ||
    subscription.status !== "active" ||
    subscription.productId !== productId
  ) {
    return false;
  }

  if (!subscription.expiresAt) {
    return true;
  }

  return new Date(subscription.expiresAt).getTime() > Date.now();
};

export const getPlanTier = ({
  isLoggedIn,
  subscription
}: {
  isLoggedIn: boolean;
  subscription: UserSubscription | null;
}): PlanTier => {
  if (!isLoggedIn) {
    return "guest";
  }

  if (isActivePremiumProduct(subscription, "expert_monthly")) {
    return "expert";
  }

  if (isActivePremiumProduct(subscription, "creator_monthly")) {
    return "pro";
  }

  if (isActivePremiumProduct(subscription, "ad_remove")) {
    return "ad_remove";
  }

  return "free";
};

export const getPlanEntitlements = (params: {
  isLoggedIn: boolean;
  subscription: UserSubscription | null;
}) => PLAN_ENTITLEMENTS[getPlanTier(params)];

export const getWeeklyVideoExportLimit = (entitlements: PlanEntitlements) =>
  entitlements.weeklyVideoExportLimit;
