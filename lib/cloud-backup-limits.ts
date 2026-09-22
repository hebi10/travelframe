export const CLOUD_BACKUP_PHOTO_LIMIT_PER_PROJECT = 365;
export const CLOUD_BACKUP_IMAGE_WORK_LIMIT = 200;
export const CLOUD_BACKUP_VIDEO_LIMIT = 50;
export const CLOUD_BACKUP_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
export const CLOUD_BACKUP_PLUS_STORAGE_LIMIT_BYTES = 6 * 1024 * 1024 * 1024;
export const CLOUD_BACKUP_EXPERT_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

export type CloudBackupLimitTier =
  | "guest"
  | "free"
  | "ad_remove"
  | "pro"
  | "plus"
  | "expert";

export const getCloudBackupVideoLimit = (
  _tier: CloudBackupLimitTier = "pro"
) => CLOUD_BACKUP_VIDEO_LIMIT;

export const getCloudBackupStorageLimitBytes = (
  tier: CloudBackupLimitTier = "pro"
) => {
  if (tier === "expert") {
    return CLOUD_BACKUP_EXPERT_STORAGE_LIMIT_BYTES;
  }
  if (tier === "plus") {
    return CLOUD_BACKUP_PLUS_STORAGE_LIMIT_BYTES;
  }
  return CLOUD_BACKUP_STORAGE_LIMIT_BYTES;
};

export const getCloudBackupProjectLimit = (
  tier: CloudBackupLimitTier
) => {
  if (tier === "expert") return 5;
  if (tier === "plus") return 3;
  if (tier === "pro") return 1;
  return 0;
};

export const getRemainingBackupSlots = (count: number, limit: number) =>
  Math.max(0, limit - Math.max(0, count));

export const canBackupMoreVideos = (
  videoCount: number,
  tier: CloudBackupLimitTier = "pro"
) => getRemainingBackupSlots(videoCount, getCloudBackupVideoLimit(tier)) > 0;
