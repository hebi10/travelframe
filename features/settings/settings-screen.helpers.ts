import { GUIDE_SIZE_MAX, GUIDE_SIZE_MIN } from "@/lib/app-settings";
import { formatBackupStorageUsage } from "@/lib/image-backup-utils";

export const clampSettingsGuideSize = (value: number) =>
  Math.round(Math.max(GUIDE_SIZE_MIN, Math.min(GUIDE_SIZE_MAX, value)));

export const getGuideSizeFromTrackX = (locationX: number, trackWidth: number) => {
  if (!Number.isFinite(locationX) || trackWidth <= 0) {
    return GUIDE_SIZE_MIN;
  }

  const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
  return clampSettingsGuideSize(
    GUIDE_SIZE_MIN + ratio * (GUIDE_SIZE_MAX - GUIDE_SIZE_MIN)
  );
};

export const formatQuotaValue = (used: number, limit: number) => {
  if (limit <= 0) {
    return "사용 불가";
  }

  const safeUsed = Math.max(0, used);
  const safeLimit = Math.max(0, limit);
  return `${safeUsed} / ${safeLimit} · 남은 ${Math.max(0, safeLimit - safeUsed)}`;
};


export const formatStorageQuotaValue = (usedBytes: number, limitBytes: number) => {
  if (limitBytes <= 0) {
    return "사용 불가";
  }

  return formatBackupStorageUsage(usedBytes, limitBytes);
};


export const formatBackupDateTime = (value?: string | null) => {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
};
