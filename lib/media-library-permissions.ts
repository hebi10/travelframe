export type MediaLibraryAccessState = "full" | "limited" | "denied" | "blocked";

export type MediaLibraryPermissionLike = {
  granted?: boolean;
  canAskAgain?: boolean;
  accessPrivileges?: "all" | "limited" | "none" | string | null;
};

export const getMediaLibraryAccessState = (
  permission: MediaLibraryPermissionLike
): MediaLibraryAccessState => {
  if (permission.granted) {
    return permission.accessPrivileges === "limited" ? "limited" : "full";
  }

  return permission.canAskAgain === false ? "blocked" : "denied";
};

export const isMediaLibraryAccessGranted = (state: MediaLibraryAccessState) =>
  state === "full" || state === "limited";

export const shouldOpenMediaLibrarySettings = (state: MediaLibraryAccessState) =>
  state === "limited" || state === "blocked";

export const getMediaLibraryPermissionMessage = (
  state: MediaLibraryAccessState,
  fallbackMessage: string
) => {
  if (state === "limited") {
    return "선택한 사진만 표시됩니다. 더 많은 사진을 쓰려면 Android 설정에서 사진 접근 권한을 전체 허용으로 바꾸거나 다시 선택해 주세요.";
  }

  if (state === "blocked") {
    return "사진 접근 권한이 차단되어 있습니다. Android 설정에서 사진 및 동영상 권한을 허용한 뒤 다시 시도해 주세요.";
  }

  return fallbackMessage;
};
