import {
  DEFAULT_VIDEO_QUALITY,
  MAX_VIDEO_DURATION_SECONDS,
  VIDEO_QUALITY_OPTIONS,
  type VideoQualityId
} from "@/constants/video";

export const calculateVideoDuration = (
  photoIds: string[],
  getDuration: (id: string, index: number) => number
) =>
  photoIds.reduce((sum, id, index) => {
    const duration = getDuration(id, index);
    return sum + (Number.isFinite(duration) ? Math.max(0, duration) : 0);
  }, 0);

export const isVideoDurationTooLong = (
  seconds: number,
  maxSeconds = MAX_VIDEO_DURATION_SECONDS
) => seconds > maxSeconds;

export const formatVideoDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
};

export const getVideoQualityOption = (qualityId: VideoQualityId) =>
  VIDEO_QUALITY_OPTIONS.find((option) => option.id === qualityId) ??
  VIDEO_QUALITY_OPTIONS.find((option) => option.id === DEFAULT_VIDEO_QUALITY) ??
  VIDEO_QUALITY_OPTIONS[0];

export const getVideoQualityOutputSize = (
  qualityId: VideoQualityId,
  aspectRatio: number
) => {
  const quality = getVideoQualityOption(qualityId);
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0
    ? aspectRatio
    : 9 / 16;

  if (safeAspectRatio <= 1) {
    return {
      width: Math.round(quality.height * safeAspectRatio),
      height: quality.height
    };
  }

  return {
    width: quality.height,
    height: Math.round(quality.height / safeAspectRatio)
  };
};
