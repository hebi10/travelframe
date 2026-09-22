import type { UserSubscription } from "@/lib/subscription";

export type PlanTier =
  | "guest"
  | "free"
  | "ad_remove"
  | "pro"
  | "plus"
  | "expert";

export type PlanEntitlements = {
  tier: PlanTier;
  label: string;
  canExportVideo: boolean;
  weeklyVideoExportLimit: number;
  showAds: boolean;
  showWatermark: boolean;
  canUseAdvancedOutput: boolean;
  canBackupToCloud: boolean;
  localImageLimit?: number;
  localVideoLimit: number;
  musicTrackLimit: number;
  backupStorageBytes: number;
  maxProgressPhotos: number | null;
  maxProgressVideoSeconds: number | null;
  maxProjectCount: number | null;
  maxCloudBackupProjects: number;
  maxCloudPhotosPerProject: number;
};

export const GIB = 1024 * 1024 * 1024;

const FREE_PROGRESS_PHOTO_LIMIT = 100;
const FREE_PROGRESS_VIDEO_SECONDS = 10;
const PAID_PROGRESS_VIDEO_SECONDS = 36.5;
export const CLOUD_BACKUP_PHOTOS_PER_PROJECT = 365;

const paidPlan = ({
  tier,
  label,
  maxCloudBackupProjects,
  backupStorageBytes
}: {
  tier: "pro" | "plus" | "expert";
  label: string;
  maxCloudBackupProjects: number;
  backupStorageBytes: number;
}): PlanEntitlements => ({
  tier,
  label,
  canExportVideo: true,
  weeklyVideoExportLimit: 15,
  showAds: false,
  showWatermark: false,
  canUseAdvancedOutput: true,
  canBackupToCloud: true,
  localImageLimit: undefined,
  localVideoLimit: 50,
  musicTrackLimit: 10,
  backupStorageBytes,
  maxProgressPhotos: null,
  maxProgressVideoSeconds: PAID_PROGRESS_VIDEO_SECONDS,
  maxProjectCount: null,
  maxCloudBackupProjects,
  maxCloudPhotosPerProject: CLOUD_BACKUP_PHOTOS_PER_PROJECT
});

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
    localImageLimit: 100,
    localVideoLimit: 30,
    musicTrackLimit: 0,
    backupStorageBytes: 0,
    maxProgressPhotos: FREE_PROGRESS_PHOTO_LIMIT,
    maxProgressVideoSeconds: FREE_PROGRESS_VIDEO_SECONDS,
    maxProjectCount: 1,
    maxCloudBackupProjects: 0,
    maxCloudPhotosPerProject: 0
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
    backupStorageBytes: 0,
    maxProgressPhotos: FREE_PROGRESS_PHOTO_LIMIT,
    maxProgressVideoSeconds: FREE_PROGRESS_VIDEO_SECONDS,
    maxProjectCount: 1,
    maxCloudBackupProjects: 0,
    maxCloudPhotosPerProject: 0
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
    backupStorageBytes: 0,
    maxProgressPhotos: FREE_PROGRESS_PHOTO_LIMIT,
    maxProgressVideoSeconds: FREE_PROGRESS_VIDEO_SECONDS,
    maxProjectCount: 1,
    maxCloudBackupProjects: 0,
    maxCloudPhotosPerProject: 0
  },
  pro: paidPlan({
    tier: "pro",
    label: "Pro",
    maxCloudBackupProjects: 1,
    backupStorageBytes: 2 * GIB
  }),
  plus: paidPlan({
    tier: "plus",
    label: "Plus",
    maxCloudBackupProjects: 3,
    backupStorageBytes: 6 * GIB
  }),
  expert: paidPlan({
    tier: "expert",
    label: "Expert",
    maxCloudBackupProjects: 5,
    backupStorageBytes: 10 * GIB
  })
};

const isActivePremiumProduct = (
  subscription: UserSubscription | null,
  productId: string
) => {
  const rawProductId = subscription?.productId as string | undefined;
  const normalizedProductId =
    rawProductId === "ad_remove" ||
    rawProductId === "creator_monthly" ||
    rawProductId === "plus_monthly" ||
    rawProductId === "expert_monthly"
      ? rawProductId
      : rawProductId === "premium" ||
          (!rawProductId && subscription?.plan === "premium")
        ? "creator_monthly"
        : "free";

  if (
    !subscription ||
    subscription.plan !== "premium" ||
    subscription.status !== "active" ||
    normalizedProductId !== productId
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

  if (isActivePremiumProduct(subscription, "plus_monthly")) {
    return "plus";
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
