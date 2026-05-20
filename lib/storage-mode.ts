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
    label: "로컬 저장만 사용",
    detail: "출력 결과를 기기에만 저장하고 클라우드 백업은 사용하지 않습니다.",
    requiresBackupPlan: false
  },
  {
    value: "local_backup",
    label: "로컬 저장 + 클라우드 백업",
    detail: "먼저 기기에 저장하고 백업 가능 플랜이면 서버에도 업로드합니다.",
    requiresBackupPlan: false
  },
  {
    value: "local_saver",
    label: "로컬 용량 절약 모드",
    detail: "백업 완료 후 원본 로컬 파일을 비우고 썸네일과 메타데이터를 유지합니다.",
    requiresBackupPlan: true
  }
];

export const isCloudBackupStorageMode = (storageMode: StorageMode) =>
  storageMode === "local_backup" || storageMode === "local_saver";

export const isStorageSaverMode = (
  storageMode: StorageMode,
  canBackupToCloud: boolean
) => storageMode === "local_saver" && canBackupToCloud;

export const getEffectiveStorageMode = (
  storageMode: StorageMode,
  canBackupToCloud: boolean
): StorageMode => {
  if (storageMode === "local_saver" && !canBackupToCloud) {
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
