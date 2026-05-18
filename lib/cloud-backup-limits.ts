export const CLOUD_BACKUP_PHOTO_LIMIT = 200;
export const CLOUD_BACKUP_IMAGE_WORK_LIMIT = 200;
export const CLOUD_BACKUP_VIDEO_LIMIT = 50;

export const getRemainingBackupSlots = (count: number, limit: number) =>
  Math.max(0, limit - Math.max(0, count));

export const canBackupMoreVideos = (videoCount: number) =>
  getRemainingBackupSlots(videoCount, CLOUD_BACKUP_VIDEO_LIMIT) > 0;
