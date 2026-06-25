import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PhotoEditTransform } from "@/types/photo";

const EDIT_DRAFT_STORAGE_KEY = "travel-frame.edit-draft.v1";

export type PhotoEditDraft = {
  sourceUri: string;
  sourcePhotoId?: string;
  width?: number;
  height?: number;
  transform: PhotoEditTransform;
  updatedAt: string;
};

const parseEditDraft = (value: string | null): PhotoEditDraft | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as PhotoEditDraft;
    return parsed?.sourceUri && parsed?.transform ? parsed : null;
  } catch {
    return null;
  }
};

export const getEditDraft = async () => {
  const value = await AsyncStorage.getItem(EDIT_DRAFT_STORAGE_KEY);
  return parseEditDraft(value);
};

export const saveEditDraft = async (draft: Omit<PhotoEditDraft, "updatedAt">) => {
  const nextDraft: PhotoEditDraft = {
    ...draft,
    updatedAt: new Date().toISOString()
  };

  await AsyncStorage.setItem(EDIT_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
  return nextDraft;
};

export const clearEditDraft = async () => {
  await AsyncStorage.removeItem(EDIT_DRAFT_STORAGE_KEY);
};

export const isSameEditDraftSource = (
  draft: PhotoEditDraft,
  source: { uri: string; sourcePhotoId?: string }
) => {
  if (draft.sourcePhotoId && source.sourcePhotoId) {
    return draft.sourcePhotoId === source.sourcePhotoId;
  }

  return draft.sourceUri === source.uri;
};
