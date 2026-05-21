import type { ImageSaveFormat } from "@/lib/trip-clip-export";

export const RECORDING_VIEW_WIDTH = 360;

export const IMAGE_SAVE_FORMAT_OPTIONS: {
  label: string;
  value: ImageSaveFormat;
  detail: string;
}[] = [
  {
    label: "원본 형식",
    value: "original",
    detail: "추가 압축 없이 현재 앱에 저장된 이미지 파일을 그대로 저장합니다."
  },
  {
    label: "PNG",
    value: "png",
    detail: "무손실 PNG로 변환해 저장합니다."
  },
  {
    label: "JPG",
    value: "jpeg",
    detail: "호환성이 높은 JPG로 저장합니다."
  }
];
