import { useCallback, useMemo } from "react";

import type { TripClipTransition } from "@/constants/trip-clip";
import { getRecordingFrame } from "@/lib/trip-clip-playback";
import type { PhotoItem } from "@/types/photo";

type UseTripClipPlaybackInput = {
  frameIndex: number;
  fps: number;
  selectedPhotos: PhotoItem[];
  selectedIds: string[];
  durations: Record<string, number>;
  transition: TripClipTransition;
  transitionDuration: number;
  totalDuration: number;
  getFrameDuration: (id: string, index: number) => number;
};

export function useTripClipPlayback({
  frameIndex,
  fps,
  selectedPhotos,
  selectedIds,
  durations,
  transition,
  transitionDuration,
  totalDuration,
  getFrameDuration
}: UseTripClipPlaybackInput) {
  const recordingFrame = useMemo(
    () =>
      getRecordingFrame({
        frameIndex,
        fps,
        photos: selectedPhotos,
        durations,
        transition,
        transitionDuration
      }),
    [durations, frameIndex, fps, selectedPhotos, transition, transitionDuration]
  );

  const getStartTimeForIndex = useCallback(
    (index: number) =>
      selectedIds
        .slice(0, Math.max(0, index))
        .reduce((sum, id, itemIndex) => sum + getFrameDuration(id, itemIndex), 0),
    [getFrameDuration, selectedIds]
  );

  const getPlaybackPosition = useCallback(
    (seconds: number) => {
      const safeSeconds = Math.max(0, Math.min(totalDuration, seconds));
      let elapsed = 0;

      for (let index = 0; index < selectedIds.length; index += 1) {
        const id = selectedIds[index];
        const duration = getFrameDuration(id, index);
        const isLast = index === selectedIds.length - 1;

        if (safeSeconds < elapsed + duration || isLast) {
          return {
            index,
            offset: Math.max(0, Math.min(duration, safeSeconds - elapsed)),
            seconds: safeSeconds
          };
        }

        elapsed += duration;
      }

      return {
        index: 0,
        offset: 0,
        seconds: 0
      };
    },
    [getFrameDuration, selectedIds, totalDuration]
  );

  return {
    recordingFrame,
    getStartTimeForIndex,
    getPlaybackPosition
  };
}
