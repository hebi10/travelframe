export type VideoQualityId = "480p" | "720p" | "1080p";

export const MAX_VIDEO_DURATION_SECONDS = 180;
export const DEFAULT_VIDEO_QUALITY: VideoQualityId = "720p";

export const VIDEO_DURATION_LIMIT_MESSAGE =
  "영상은 최대 3분까지 만들 수 있습니다. 사진 수를 줄이거나 사진 노출 시간을 조정해주세요.";

export const VIDEO_EXPORT_BLOCKED_MESSAGE =
  "영상 길이가 3분을 초과하여 내보내기할 수 없습니다. 사진 수를 줄이거나 사진 노출 시간을 조정해주세요.";

export const VIDEO_QUALITY_DESCRIPTION =
  "화질이 높을수록 영상이 선명하지만 저장 용량이 커질 수 있습니다.";

export const VIDEO_QUALITY_OPTIONS: {
  id: VideoQualityId;
  label: string;
  width: number;
  height: number;
  bitrate: number;
}[] = [
  {
    id: "480p",
    label: "저용량 480p",
    width: 480,
    height: 854,
    bitrate: 1200000
  },
  {
    id: "720p",
    label: "일반 화질 720p",
    width: 720,
    height: 1280,
    bitrate: 3000000
  },
  {
    id: "1080p",
    label: "고화질 1080p",
    width: 1080,
    height: 1920,
    bitrate: 5000000
  }
];
