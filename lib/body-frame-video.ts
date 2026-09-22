type BodyFrameVideoPhotoLike = {
  id: string;
  projectId?: string;
  sequence?: number;
  createdAt?: string;
};

export const BODY_FRAME_VIDEO_SECONDS_PER_PHOTO = 0.1;
export const BODY_FRAME_VIDEO_FPS = 30;
export const BODY_FRAME_VIDEO_FRAMES_PER_PHOTO = 3;
export const BODY_FRAME_VIDEO_RATIO = "3:4" as const;
export const BODY_FRAME_VIDEO_TEMPLATE = "minimal" as const;
export const BODY_FRAME_VIDEO_TRANSITION = "none" as const;
export const BODY_FRAME_VIDEO_TRANSITION_DURATION = 0;
export const BODY_FRAME_VIDEO_INTERVALS = [0.1, 0.2, 0.5, 1] as const;
export const BODY_FRAME_VIDEO_QUALITIES = [720, 1080] as const;
export const BODY_FRAME_VIDEO_RATIOS = ["3:4", "9:16", "1:1", "16:9"] as const;
export const BODY_FRAME_VIDEO_OVERLAY_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right"
] as const;

export type BodyFrameVideoOverlayPosition =
  (typeof BODY_FRAME_VIDEO_OVERLAY_POSITIONS)[number];

export type BodyFrameVideoOverlayOptions = {
  showDate: boolean;
  showWeight: boolean;
  showBodyFat: boolean;
  customText: string;
  position: BodyFrameVideoOverlayPosition;
};

export type BodyFrameVideoOptions = {
  interval: (typeof BODY_FRAME_VIDEO_INTERVALS)[number];
  quality: (typeof BODY_FRAME_VIDEO_QUALITIES)[number];
  ratio: (typeof BODY_FRAME_VIDEO_RATIOS)[number];
  overlay: BodyFrameVideoOverlayOptions;
};

export const DEFAULT_BODY_FRAME_VIDEO_OVERLAY: BodyFrameVideoOverlayOptions = {
  showDate: false,
  showWeight: false,
  showBodyFat: false,
  customText: "",
  position: "bottom-right"
};

export const DEFAULT_BODY_FRAME_VIDEO_OPTIONS: BodyFrameVideoOptions = {
  interval: BODY_FRAME_VIDEO_SECONDS_PER_PHOTO,
  quality: 1080,
  ratio: BODY_FRAME_VIDEO_RATIO,
  overlay: DEFAULT_BODY_FRAME_VIDEO_OVERLAY
};
export const getBodyFrameVideoOutputSize = (
  ratio: BodyFrameVideoOptions["ratio"],
  quality: BodyFrameVideoOptions["quality"]
) => {
  const longEdge = quality === 720 ? 1280 : 1920;
  return ratio === "3:4"
    ? { width: quality, height: quality * 4 / 3 }
    : ratio === "1:1"
    ? { width: quality, height: quality }
    : ratio === "16:9"
      ? { width: longEdge, height: quality }
      : { width: quality, height: longEdge };
};
export const getBodyFrameVideoPhotoIndex = (
  frameIndex: number,
  interval = BODY_FRAME_VIDEO_SECONDS_PER_PHOTO
) => Math.floor(Math.max(0, frameIndex) / Math.round(interval * BODY_FRAME_VIDEO_FPS));
export const BODY_FRAME_VIDEO_MAX_OUTPUT_SIZE = {
  width: 1080,
  height: 1440
} as const;

const toSafePhotoCount = (value: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const getSequenceSortValue = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;

const getCreatedAtSortValue = (value: unknown) => {
  if (typeof value !== "string") {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

export const selectBodyFrameVideoPhotos = <T extends BodyFrameVideoPhotoLike>(
  projectPhotos: T[],
  selectedIds: string[] | null
): T[] => {
  const selected = selectedIds === null ? null : new Set(selectedIds);
  return projectPhotos.filter(photo => selected === null || selected.has(photo.id));
};

export const getBodyFrameVideoPhotos = <T extends BodyFrameVideoPhotoLike>(
  photos: T[],
  projectId: string
): T[] =>
  photos
    .filter((photo) => photo.projectId === projectId)
    .sort((first, second) => {
      const firstSequence = getSequenceSortValue(first.sequence);
      const secondSequence = getSequenceSortValue(second.sequence);

      if (firstSequence !== null || secondSequence !== null) {
        if (firstSequence === null) {
          return 1;
        }
        if (secondSequence === null) {
          return -1;
        }
        if (firstSequence !== secondSequence) {
          return firstSequence - secondSequence;
        }
      }

      const firstCreatedAt = getCreatedAtSortValue(first.createdAt);
      const secondCreatedAt = getCreatedAtSortValue(second.createdAt);
      if (firstCreatedAt !== secondCreatedAt) {
        return firstCreatedAt - secondCreatedAt;
      }

      return first.id.localeCompare(second.id);
    });

export const createBodyFrameVideoDurations = <T extends BodyFrameVideoPhotoLike>(
  photos: T[],
  interval = BODY_FRAME_VIDEO_SECONDS_PER_PHOTO
): Record<string, number> =>
  Object.fromEntries(
    photos.map((photo) => [photo.id, interval])
  );

export const getBodyFrameVideoDuration = (photoCount: number, interval = BODY_FRAME_VIDEO_SECONDS_PER_PHOTO) => {
  const safeCount = toSafePhotoCount(photoCount);
  return Number((safeCount * interval).toFixed(1));
};

export const getBodyFrameVideoTotalFrames = (photoCount: number, interval = BODY_FRAME_VIDEO_SECONDS_PER_PHOTO) =>
  toSafePhotoCount(photoCount) * Math.round(interval * BODY_FRAME_VIDEO_FPS);


export const formatBodyFrameVideoOverlayDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return [
    String(date.getFullYear()).slice(-2),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join(".");
};

export const getBodyFrameVideoOverlayText = ({
  photo,
  measurement,
  overlay
}: {
  photo?: { createdAt?: string } | null;
  measurement?: { weightKg?: number; bodyFatPercent?: number } | null;
  overlay: BodyFrameVideoOverlayOptions;
}) => {
  const parts: string[] = [];
  const customText = overlay.customText.trim();

  if (customText) {
    parts.push(customText);
  }

  if (overlay.showDate) {
    const date = formatBodyFrameVideoOverlayDate(photo?.createdAt);
    if (date) {
      parts.push(date);
    }
  }

  if (
    overlay.showWeight &&
    typeof measurement?.weightKg === "number" &&
    Number.isFinite(measurement.weightKg)
  ) {
    parts.push(`${Number(measurement.weightKg.toFixed(1))}kg`);
  }

  if (
    overlay.showBodyFat &&
    typeof measurement?.bodyFatPercent === "number" &&
    Number.isFinite(measurement.bodyFatPercent)
  ) {
    parts.push(`${Number(measurement.bodyFatPercent.toFixed(1))}%`);
  }

  return parts.join(" · ");
};

export const getBodyFrameVideoOverlaySummary = (
  overlay: BodyFrameVideoOverlayOptions
) => {
  const parts = [
    overlay.showDate ? "날짜" : null,
    overlay.showWeight ? "몸무게" : null,
    overlay.showBodyFat ? "체지방" : null,
    overlay.customText.trim() ? "텍스트" : null
  ].filter((item): item is string => Boolean(item));

  return parts.length > 0 ? parts.join(" · ") : "없음";
};
