import { IMAGE_QUALITY_OPTIONS } from "@/constants/image";
import { VIDEO_QUALITY_OPTIONS } from "@/constants/video";
import { DEFAULT_GUIDE_COLOR, getCameraSaveScopeTargets, type AppImageSaveFormat, type AppSettings, type CameraSaveScope, type CameraSaveTarget, type CloudBackupTarget, type FontSize, type TripClipExportFormat, type ThemeMode } from "@/lib/app-settings";

export type SettingKey =
  | "defaultGuide"
  | "guideVisible"
  | "guideSize"
  | "guideStrokeWidth"
  | "guideColor"
  | "guideLineOpacity"
  | "cameraRatio"
  | "cameraSaveScope"
  | "defaultRatio"
  | "videoQuality"
  | "tripClipExportFormat"
  | "imageSaveFormat"
  | "themeMode"
  | "fontStyle"
  | "fontSize"
  | "storageMode"
  | "cloudBackupEnabled"
  | "cloudBackupTargets"
  | "imageBackupQuality";

export const guideLineOpacityOptions = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1];
export const cameraRatioOptions = ["1:1", "3:4", "4:3", "4:5", "9:16", "16:9"] as const;


export const storageModeLegend =
  "앱 보관함 / 핸드폰 앨범 / 클라우드";
export const backupTargetOptions: {
  value: CloudBackupTarget;
  label: string;
  detail: string;
}[] = [
  { value: "photos", label: "사진", detail: "앱 사진 목록을 백업합니다." },
  { value: "imageBundles", label: "여러 사진 작업", detail: "편집/여행 클립 이미지 작업을 백업합니다." },
  { value: "videos", label: "영상", detail: "완성된 MP4 영상을 백업합니다." },
  { value: "music", label: "음악", detail: "사용자 음악 파일을 백업합니다." }
];

export const getBackupTargetsSummary = (targets: AppSettings["cloudBackupTargets"]) => {
  const selectedLabels = backupTargetOptions
    .filter((option) => targets[option.value] !== false)
    .map((option) => option.label);

  if (selectedLabels.length === backupTargetOptions.length) {
    return "전체";
  }

  return selectedLabels.length > 0 ? selectedLabels.join(", ") : "선택 없음";
};

export const cameraSaveScopeOptions: { value: CameraSaveTarget; label: string; detail: string }[] = [
  { value: "app", label: "앱 보관함", detail: "보관함 탭에서 다시 열 수 있도록 앱에 저장합니다." },
  { value: "device", label: "핸드폰 앨범", detail: "기기 갤러리 앱에서도 볼 수 있도록 저장합니다." },
  { value: "cloud", label: "클라우드", detail: "로그인 및 백업 설정이 가능한 경우 계정에 백업합니다." }
];
export const tripClipExportFormatOptions: {
  value: TripClipExportFormat;
  label: string;
  detail: string;
}[] = [
  { value: "mp4", label: "MP4 영상", detail: "영상으로 저장하는 화면을 기본값으로 엽니다." },
  { value: "images", label: "이미지 저장", detail: "개별 이미지 저장 화면을 기본값으로 엽니다." }
];
export const imageSaveFormatOptions: {
  value: AppImageSaveFormat;
  label: string;
  detail: string;
}[] = [
  { value: "original", label: "원본 형식", detail: "현재 앱에 저장된 이미지 형식을 유지합니다." },
  { value: "png", label: "PNG", detail: "무손실 PNG로 저장합니다." },
  { value: "jpeg", label: "JPG", detail: "호환성이 높은 JPG로 저장합니다." }
];

export const guideSizeOptions = [
  { label: "작게", value: 34 },
  { label: "기본", value: 44 },
  { label: "크게", value: 56 }
] as const;

export const guideStrokeWidthOptions = [1, 2, 3, 4, 5] as const;

export const guideColorOptions = [
  { label: "흰색", value: DEFAULT_GUIDE_COLOR },
  { label: "노랑", value: "#F5D76E" },
  { label: "민트", value: "#8CECC1" },
  { label: "파랑", value: "#A9D7FF" },
  { label: "빨강", value: "#FF5A5F" },
  { label: "검정", value: "rgba(17, 17, 17, 0.78)" }
] as const;

export const imageQualityLabel = IMAGE_QUALITY_OPTIONS.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label
  }),
  {} as Record<(typeof IMAGE_QUALITY_OPTIONS)[number]["value"], string>
);
export const getCameraSaveScopeLabel = (scope: CameraSaveScope) => {
  const targets = getCameraSaveScopeTargets(scope);
  return cameraSaveScopeOptions
    .filter((option) => targets[option.value])
    .map((option) => option.label)
    .join(" + ");
};
export const tripClipExportFormatLabel = tripClipExportFormatOptions.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label
  }),
  {} as Record<TripClipExportFormat, string>
);
export const imageSaveFormatLabel = imageSaveFormatOptions.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label
  }),
  {} as Record<AppImageSaveFormat, string>
);
export const videoQualityLabel = VIDEO_QUALITY_OPTIONS.reduce(
  (labels, option) => ({
    ...labels,
    [option.id]: option.label
  }),
  {} as Record<(typeof VIDEO_QUALITY_OPTIONS)[number]["id"], string>
);

export const themeOptions: {
  value: ThemeMode;
  label: string;
  detail: string;
}[] = [
  { value: "light", label: "라이트", detail: "밝은 흑백 화면으로 고정합니다." },
  { value: "dark", label: "다크", detail: "어두운 흑백 화면을 사용합니다." },
  { value: "system", label: "시스템", detail: "기기 화면 설정을 따릅니다." }
];

export const themeLabel: Record<ThemeMode, string> = {
  light: "라이트",
  dark: "다크",
  system: "시스템"
};

export const fontSizeOptions: {
  value: FontSize;
  label: string;
  detail: string;
}[] = [
  { value: "small", label: "작게", detail: "정보가 많은 화면을 더 촘촘하게 봅니다." },
  { value: "medium", label: "기본", detail: "대부분의 화면에 맞는 표준 크기입니다." },
  { value: "large", label: "크게", detail: "제목과 설명을 더 크게 표시합니다." }
];

export const fontSizeLabel: Record<FontSize, string> = {
  small: "작게",
  medium: "기본",
  large: "크게"
};
