type DeselectTripClipPhotoParams = {
  photoId: string;
  selectedIds: string[];
  durations: Record<string, number>;
  activeIndex: number;
};

export const deselectTripClipPhoto = ({
  photoId,
  selectedIds,
  durations,
  activeIndex
}: DeselectTripClipPhotoParams) => {
  if (!selectedIds.includes(photoId)) {
    return { selectedIds, durations, activeIndex };
  }

  const nextSelectedIds = selectedIds.filter((id) => id !== photoId);
  const nextDurations = { ...durations };
  delete nextDurations[photoId];

  return {
    selectedIds: nextSelectedIds,
    durations: nextDurations,
    activeIndex: Math.max(0, Math.min(activeIndex, nextSelectedIds.length - 1))
  };
};
