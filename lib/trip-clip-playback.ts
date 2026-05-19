import type { TripClipTransition } from "@/constants/trip-clip";
import type { PhotoItem } from "@/types/photo";

export const DEFAULT_TRIP_CLIP_FRAME_DURATION = 2.5;
export const FIRST_TRIP_CLIP_FRAME_DURATION = Math.max(
  0.5,
  DEFAULT_TRIP_CLIP_FRAME_DURATION - 0.5
);

export type RecordingFrame = {
  currentPhoto: PhotoItem | null;
  nextPhoto: PhotoItem | null;
  transitionProgress: number;
};

export const getDefaultFrameDuration = (index: number) =>
  index === 0 ? FIRST_TRIP_CLIP_FRAME_DURATION : DEFAULT_TRIP_CLIP_FRAME_DURATION;

export const getRecordingFrame = ({
  frameIndex,
  fps,
  photos,
  durations,
  transition,
  transitionDuration
}: {
  frameIndex: number;
  fps: number;
  photos: PhotoItem[];
  durations: Record<string, number>;
  transition: TripClipTransition;
  transitionDuration: number;
}): RecordingFrame => {
  if (photos.length === 0) {
    return {
      currentPhoto: null,
      nextPhoto: null,
      transitionProgress: 0
    };
  }

  const seconds = frameIndex / fps;
  let elapsed = 0;

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const duration = durations[photo.id] ?? getDefaultFrameDuration(index);
    const isLast = index === photos.length - 1;

    if (seconds < elapsed + duration || isLast) {
      const localSeconds = Math.max(0, Math.min(duration, seconds - elapsed));
      const nextPhoto = photos[index + 1] ?? null;
      const transitionWindow =
        transition === "none" || !nextPhoto
          ? 0
          : Math.max(0.1, Math.min(transitionDuration, duration * 0.5));
      const transitionStart = duration - transitionWindow;
      const transitionProgress =
        transitionWindow > 0 && localSeconds >= transitionStart
          ? Math.max(0, Math.min(1, (localSeconds - transitionStart) / transitionWindow))
          : 0;

      return {
        currentPhoto: photo,
        nextPhoto: transitionProgress > 0 ? nextPhoto : null,
        transitionProgress
      };
    }

    elapsed += duration;
  }

  return {
    currentPhoto: photos[photos.length - 1] ?? null,
    nextPhoto: null,
    transitionProgress: 0
  };
};
