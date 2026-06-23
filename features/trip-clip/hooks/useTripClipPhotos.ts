import { useCallback, useMemo } from "react";

import { getDefaultFrameDuration } from "@/lib/trip-clip-playback";
import type { PhotoItem } from "@/types/photo";

type UseTripClipPhotosInput = {
  photos: PhotoItem[];
  selectedIds: string[];
  durations: Record<string, number>;
  activeIndex: number;
};

export function useTripClipPhotos({
  photos,
  selectedIds,
  durations,
  activeIndex
}: UseTripClipPhotosInput) {
  const selectedPhotos = useMemo(
    () =>
      selectedIds
        .map((id) => photos.find((photo) => photo.id === id))
        .filter((photo): photo is PhotoItem => Boolean(photo)),
    [photos, selectedIds]
  );

  const activePhoto = selectedPhotos[activeIndex] ?? selectedPhotos[0];
  const getFrameDuration = useCallback(
    (id: string, index: number) => durations[id] ?? getDefaultFrameDuration(index),
    [durations]
  );

  return {
    selectedPhotos,
    activePhoto,
    getFrameDuration
  };
}
