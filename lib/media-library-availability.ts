export const MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE =
  "현재 실행 환경에서는 앨범 직접 저장을 사용할 수 없습니다. Android 개발 빌드 또는 Play Store 빌드에서 다시 시도하거나 공유 기능으로 저장해 주세요.";

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
