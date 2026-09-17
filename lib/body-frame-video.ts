type BodyFrameVideoPhotoLike = {
  id: string;
  projectId?: string;
  sequence?: number;
  createdAt?: string;
};

export const BODY_FRAME_VIDEO_SECONDS_PER_PHOTO = 0.1;
export const BODY_FRAME_VIDEO_FPS = 30;
export const BODY_FRAME_VIDEO_FRAMES_PER_PHOTO = 3;
export const BODY_FRAME_VIDEO_RATIO = "9:16" as const;
export const BODY_FRAME_VIDEO_TEMPLATE = "minimal" as const;
export const BODY_FRAME_VIDEO_TRANSITION = "none" as const;
export const BODY_FRAME_VIDEO_TRANSITION_DURATION = 0;
export const BODY_FRAME_VIDEO_MAX_OUTPUT_SIZE = {
  width: 1080,
  height: 1920
} as const;

const toSafePhotoCount = (value: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const getSequenceSortValue = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : Number.POSITIVE_INFINITY;

const getCreatedAtSortValue = (value: unknown) => {
  if (typeof value !== "string") {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

export const getBodyFrameVideoPhotos = <T extends BodyFrameVideoPhotoLike>(
  photos: T[],
  projectId: string
): T[] =>
  photos
    .filter((photo) => photo.projectId === projectId)
    .sort((first, second) => {
      const sequenceDiff =
        getSequenceSortValue(first.sequence) - getSequenceSortValue(second.sequence);
      if (Number.isFinite(sequenceDiff) && sequenceDiff !== 0) {
        return sequenceDiff;
      }

      const createdAtDiff =
        getCreatedAtSortValue(first.createdAt) - getCreatedAtSortValue(second.createdAt);
      if (Number.isFinite(createdAtDiff) && createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return first.id.localeCompare(second.id);
    });

export const createBodyFrameVideoDurations = <T extends BodyFrameVideoPhotoLike>(
  photos: T[]
): Record<string, number> =>
  Object.fromEntries(
    photos.map((photo) => [photo.id, BODY_FRAME_VIDEO_SECONDS_PER_PHOTO])
  );

export const getBodyFrameVideoDuration = (photoCount: number) => {
  const safeCount = toSafePhotoCount(photoCount);
  return Number((safeCount * BODY_FRAME_VIDEO_SECONDS_PER_PHOTO).toFixed(1));
};

export const getBodyFrameVideoTotalFrames = (photoCount: number) =>
  toSafePhotoCount(photoCount) * BODY_FRAME_VIDEO_FRAMES_PER_PHOTO;
