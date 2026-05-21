import { TRIP_CLIP_TRANSITIONS, type TripClipTransition } from "@/constants/trip-clip";
import type { ImageSaveFormat } from "@/lib/trip-clip-export";
import { IMAGE_SAVE_FORMAT_OPTIONS } from "@/features/trip-clip/trip-clip-screen.constants";

export const transitionLabel = (id: TripClipTransition) =>
  TRIP_CLIP_TRANSITIONS.find((item) => item.id === id)?.label ?? id;

export const getImageSaveFormatLabel = (format: ImageSaveFormat) =>
  IMAGE_SAVE_FORMAT_OPTIONS.find((item) => item.value === format)?.label ?? "원본 형식";
