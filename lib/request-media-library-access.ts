import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";

import {
  getMediaLibraryAccessState,
  getMediaLibraryPermissionMessage,
  isMediaLibraryAccessGranted,
  shouldOpenMediaLibrarySettings,
  type MediaLibraryAccessState
} from "@/lib/media-library-permissions";

export { isMediaLibraryAccessGranted };

export const requestMediaLibraryAccess = async ({
  fallbackMessage,
  onMessage
}: {
  fallbackMessage: string;
  onMessage?: (message: string) => void;
}): Promise<MediaLibraryAccessState> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
  const state = getMediaLibraryAccessState(permission);
  const message = getMediaLibraryPermissionMessage(state, fallbackMessage);

  if (!isMediaLibraryAccessGranted(state)) {
    onMessage?.(message);
    Alert.alert(
      "권한 필요",
      message,
      shouldOpenMediaLibrarySettings(state)
        ? [
            { text: "취소", style: "cancel" },
            { text: "설정 열기", onPress: () => void Linking.openSettings() }
          ]
        : [{ text: "확인" }]
    );
    return state;
  }

  if (state === "limited") {
    onMessage?.(message);
    Alert.alert("선택한 사진만 표시됩니다", message, [
      { text: "계속" },
      { text: "설정 열기", onPress: () => void Linking.openSettings() }
    ]);
  }

  return state;
};
