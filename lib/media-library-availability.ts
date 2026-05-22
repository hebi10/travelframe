export const MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE =
  "앨범 직접 저장을 사용할 수 없습니다. 앱을 최신 버전으로 업데이트하거나 공유 기능으로 저장해 주세요.";

type MediaLibrarySaveCandidate = {
  saveToLibraryAsync?: unknown;
} | null | undefined;

export const canSaveToMediaLibrary = (
  MediaLibrary: MediaLibrarySaveCandidate
) => typeof MediaLibrary?.saveToLibraryAsync === "function";

export const assertCanSaveToMediaLibrary = (
  MediaLibrary: MediaLibrarySaveCandidate
) => {
  if (!canSaveToMediaLibrary(MediaLibrary)) {
    throw new Error(MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE);
  }
};
