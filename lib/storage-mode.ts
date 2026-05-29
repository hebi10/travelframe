import type { StorageMode } from "@/lib/app-settings";

export type StorageModeOption = {
  value: StorageMode;
  label: string;
  detail: string;
  requiresBackupPlan: boolean;
};

export const STORAGE_MODE_OPTIONS: StorageModeOption[] = [
  {
    value: "local_only",
    label: "백업하지 않기",
    detail: "사진과 작업물을 이 기기에만 저장합니다.",
    requiresBackupPlan: false
  },
  {
    value: "local_backup",
    label: "앱 + 서버 백업",
    detail: "이 기기에 저장하고, 계정 서버에도 백업합니다.",
    requiresBackupPlan: false
  }
];

export const isCloudBackupStorageMode = (storageMode: StorageMode) =>
  storageMode === "local_backup" || storageMode === "local_saver";

export const isStorageSaverMode = (
  storageMode: StorageMode,
  canBackupToCloud: boolean
) =>
  storageMode === "local_saver" &&
  canBackupToCloud &&
  STORAGE_MODE_OPTIONS.some((option) => option.value === storageMode);

export const getEffectiveStorageMode = (
  storageMode: StorageMode,
  canBackupToCloud: boolean
): StorageMode => {
  void canBackupToCloud;

  if (storageMode === "local_saver") {
    return "local_backup";
  }

  return storageMode;
};

export const shouldUseCloudBackupForStorageMode = (
  storageMode: StorageMode,
  canBackupToCloud: boolean
) => isCloudBackupStorageMode(storageMode) && canBackupToCloud;

export const getStorageModeLabel = (storageMode: StorageMode) =>
  STORAGE_MODE_OPTIONS.find((option) => option.value === storageMode)?.label ??
  STORAGE_MODE_OPTIONS[0].label;
