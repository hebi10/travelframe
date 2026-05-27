export const CLOUD_BACKUP_PHOTO_LIMIT = 200;
export const CLOUD_BACKUP_IMAGE_WORK_LIMIT = 200;
export const CLOUD_BACKUP_VIDEO_LIMIT = 50;
export const CLOUD_BACKUP_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
export const CLOUD_BACKUP_EXPERT_VIDEO_LIMIT = 100;
export const CLOUD_BACKUP_EXPERT_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;

export type CloudBackupLimitTier = "guest" | "free" | "ad_remove" | "pro" | "expert";

export const getCloudBackupVideoLimit = (tier: CloudBackupLimitTier = "pro") =>
  tier === "expert" ? CLOUD_BACKUP_EXPERT_VIDEO_LIMIT : CLOUD_BACKUP_VIDEO_LIMIT;

export const getCloudBackupStorageLimitBytes = (tier: CloudBackupLimitTier = "pro") =>
  tier === "expert" ? CLOUD_BACKUP_EXPERT_STORAGE_LIMIT_BYTES : CLOUD_BACKUP_STORAGE_LIMIT_BYTES;

export const getRemainingBackupSlots = (count: number, limit: number) =>
  Math.max(0, limit - Math.max(0, count));

export const canBackupMoreVideos = (
  videoCount: number,
  tier: CloudBackupLimitTier = "pro"
) => getRemainingBackupSlots(videoCount, getCloudBackupVideoLimit(tier)) > 0;
