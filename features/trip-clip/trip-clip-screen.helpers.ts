import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { TRIP_CLIP_TRANSITIONS, type TripClipTransition } from "@/constants/trip-clip";
import type { ImageSaveFormat } from "@/lib/trip-clip-export";
import { IMAGE_SAVE_FORMAT_OPTIONS } from "@/features/trip-clip/trip-clip-screen.constants";

export const transitionLabel = (id: TripClipTransition) =>
  TRIP_CLIP_TRANSITIONS.find((item) => item.id === id)?.label ?? id;

export const getImageSaveFormatLabel = (format: ImageSaveFormat) =>
  IMAGE_SAVE_FORMAT_OPTIONS.find((item) => item.value === format)?.label ?? "원본 형식";

const normalizeFrameDuration = (value: number) =>
  Math.max(0.5, Math.min(8, Number(value.toFixed(1))));

export function useTimelineDurationEditing({
  autoDurationIdsRef,
  durations,
  getDefaultFrameDuration,
  getFrameDuration,
  setDurations
}: {
  autoDurationIdsRef: MutableRefObject<Set<string>>;
  durations: Record<string, number>;
  getDefaultFrameDuration: (index: number) => number;
  getFrameDuration: (id: string, index: number) => number;
  setDurations: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [durationInputValue, setDurationInputValue] = useState("");
  const setFrameDuration = (id: string, duration: number) => {
    autoDurationIdsRef.current.delete(id);
    setDurations((current) => ({ ...current, [id]: normalizeFrameDuration(duration) }));
  };
  const changeDuration = (id: string, index: number, delta: number) => {
    autoDurationIdsRef.current.delete(id);
    setDurations((current) => ({
      ...current,
      [id]: normalizeFrameDuration((current[id] ?? getDefaultFrameDuration(index)) + delta)
    }));
  };
  const beginDurationEditing = (id: string, index: number) => {
    setEditingDurationId(id);
    setDurationInputValue(getFrameDuration(id, index).toFixed(1));
  };
  const finishDurationEditing = (id: string) => {
    const normalizedInput = durationInputValue.trim().replace(",", ".");
    const parsedDuration = Number(normalizedInput);
    if (normalizedInput.length > 0 && Number.isFinite(parsedDuration)) {
      setFrameDuration(id, parsedDuration);
    }
    setEditingDurationId(null);
    setDurationInputValue("");
  };
  const finishActiveDurationEditing = () => {
    if (!editingDurationId) {
      setDurationInputValue("");
      return;
    }

    finishDurationEditing(editingDurationId);
  };
  return {
    beginDurationEditing,
    changeDuration,
    durationInputValue,
    editingDurationId,
    finishActiveDurationEditing,
    finishDurationEditing,
    setDurationInputValue
  };
}
