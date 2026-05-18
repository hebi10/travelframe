export type ImageQuality = "low" | "normal" | "high";

export const MAX_TOTAL_IMAGE_BACKUP_SIZE_BYTES = 1024 * 1024 * 1024;
export const DEFAULT_IMAGE_QUALITY: ImageQuality = "high";

export const IMAGE_BACKUP_OPTIMIZATION_MESSAGE =
  "이미지는 백업 시 자동으로 최적화되어 저장됩니다.";
export const IMAGE_QUALITY_DESCRIPTION =
  "화질이 높을수록 이미지가 선명하지만 저장 용량이 커질 수 있습니다.";
export const IMAGE_BACKUP_SIZE_EXCEEDED_MESSAGE =
  "이미지 백업 용량이 초과되었습니다. 기존 이미지를 삭제한 후 다시 시도해주세요.";
export const IMAGE_OPTIMIZATION_FAILED_MESSAGE =
  "이미지를 최적화할 수 없습니다. 다른 이미지를 선택한 후 다시 시도해주세요.";

export const IMAGE_QUALITY_OPTIONS: {
  value: ImageQuality;
  label: string;
  maxLongSide: number;
  quality: number;
  detail: string;
}[] = [
  {
    value: "low",
    label: "저용량",
    maxLongSide: 1280,
    quality: 0.78,
    detail: "용량 절약이 필요한 사용자를 위한 옵션"
  },
  {
    value: "normal",
    label: "일반 화질",
    maxLongSide: 1920,
    quality: 0.88,
    detail: "품질과 용량의 균형을 맞춘 옵션"
  },
  {
    value: "high",
    label: "고화질",
    maxLongSide: 2560,
    quality: 0.94,
    detail: "이미지 선명도를 우선하는 기본 옵션"
  }
];
