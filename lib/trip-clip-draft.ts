import type { GuideType } from "@/constants/camera-guides";
import type {
  TripClipRatio,
  TripClipTemplate,
  TripClipTransition
} from "@/constants/trip-clip";
import type { ImageQuality } from "@/constants/image";
import type { VideoQualityId } from "@/constants/video";
import { localStorageAdapter } from "@/lib/local-storage";
import type { ImageSaveFormat } from "@/lib/trip-clip-export";
import type { TripClipPhotoAdjustmentMap } from "@/lib/trip-clip-photo-adjustment";

export const TRIP_CLIP_DRAFT_STORAGE_KEY = "travel-frame.trip-clip-draft.v1";

export type TripClipDraft = {
  selectedIds: string[];
  durations: Record<string, number>;
  photoAdjustments: TripClipPhotoAdjustmentMap;
  ratio: TripClipRatio;
  videoQuality: VideoQualityId;
  imageQuality: ImageQuality;
  template: TripClipTemplate;
  transition: TripClipTransition;
  transitionDuration: number;
  musicMode: "none" | "device";
  selectedUserMusicId: string | null;
  previewAdjustEnabled: boolean;
  previewGuideVisible: boolean;
  previewGuide: GuideType;
  previewGuideSize: number;
  previewGuideStrokeWidth: number;
  previewGuideColor: string;
  previewGuideOffsetX: number;
  previewGuideOffsetY: number;
  activeEditorTab: "photos" | "timeline" | "video" | "guide" | "music" | "export";
  exportFormat: "mp4" | "images";
  imageSaveFormat: ImageSaveFormat;
  shouldBackupVideoExport: boolean;
  workTitle: string;
  updatedAt: string;
};

const parseTripClipDraft = (value: string | null): TripClipDraft | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as TripClipDraft;
    return Array.isArray(parsed?.selectedIds) && parsed?.ratio ? parsed : null;
  } catch {
    return null;
  }
};

export const getTripClipDraft = async () => {
  const value = await localStorageAdapter.getItem(TRIP_CLIP_DRAFT_STORAGE_KEY);
  return parseTripClipDraft(value);
};

export const saveTripClipDraft = async (
  draft: Omit<TripClipDraft, "updatedAt">
) => {
  const nextDraft: TripClipDraft = {
    ...draft,
    updatedAt: new Date().toISOString()
  };

  await localStorageAdapter.setItem(
    TRIP_CLIP_DRAFT_STORAGE_KEY,
    JSON.stringify(nextDraft)
  );
  return nextDraft;
};

export const clearTripClipDraft = async () => {
  await localStorageAdapter.removeItem(TRIP_CLIP_DRAFT_STORAGE_KEY);
};

export const hasTripClipDraftContent = (
  draft: Pick<TripClipDraft, "selectedIds" | "workTitle">
) => draft.selectedIds.length > 0 || draft.workTitle.trim().length > 0;
