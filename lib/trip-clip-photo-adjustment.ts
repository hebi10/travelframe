export type TripClipPhotoAdjustment = {
  translateX: number;
  translateY: number;
  scale: number;
};

export type TripClipPhotoAdjustmentMap = Record<string, TripClipPhotoAdjustment>;

export const DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT: TripClipPhotoAdjustment = {
  translateX: 0,
  translateY: 0,
  scale: 1
};

const isDefaultAdjustment = (adjustment: TripClipPhotoAdjustment) =>
  adjustment.translateX === DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT.translateX &&
  adjustment.translateY === DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT.translateY &&
  adjustment.scale === DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT.scale;

export const getTripClipPhotoAdjustment = (
  adjustments: TripClipPhotoAdjustmentMap,
  photoId?: string | null
) =>
  photoId && adjustments[photoId]
    ? adjustments[photoId]
    : DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT;

export const setTripClipPhotoAdjustment = (
  adjustments: TripClipPhotoAdjustmentMap,
  photoId: string,
  adjustment: TripClipPhotoAdjustment
) => {
  const next = { ...adjustments };

  if (isDefaultAdjustment(adjustment)) {
    delete next[photoId];
  } else {
    next[photoId] = adjustment;
  }

  return next;
};
