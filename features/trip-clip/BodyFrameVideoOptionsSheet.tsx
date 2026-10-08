import { AppText as Text, AppTextInput as TextInput } from "@/components/app-text";
import {
  Image } from "@/components/private-media-image";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import {
  BODY_FRAME_VIDEO_INTERVALS,
  BODY_FRAME_VIDEO_QUALITIES,
  BODY_FRAME_VIDEO_RATIOS,
  getBodyFrameVideoDuration,
  type BodyFrameVideoOptions,
  type BodyFrameVideoOverlayPosition
} from "@/lib/body-frame-video";
import type { PhotoItem } from "@/types/photo";

export type VideoOptionKind =
  | "photos"
  | "interval"
  | "quality"
  | "ratio"
  | "overlay";

const titles = {
  photos: "사진 선택",
  interval: "사진 간격",
  quality: "영상 화질",
  ratio: "화면 비율",
  overlay: "텍스트 오버레이"
};

const overlayPositions: Array<{
  value: BodyFrameVideoOverlayPosition;
  label: string;
}> = [
  { value: "top-left", label: "좌측 상단" },
  { value: "top-right", label: "우측 상단" },
  { value: "bottom-left", label: "좌측 하단" },
  { value: "bottom-right", label: "우측 하단" }
];

export function BodyFrameVideoOptionsSheet({
  kind, options, photos, selectedIds, onCancel, onApply
}: {
  kind: VideoOptionKind;
  options: BodyFrameVideoOptions;
  photos: PhotoItem[];
  selectedIds: string[] | null;
  onCancel: () => void;
  onApply: (options: BodyFrameVideoOptions, selectedIds: string[] | null) => void;
}) {
  const { palette } = useAppAppearance();
  const insets = useSafeAreaInsets();
  const [draftOptions, setDraftOptions] = useState(options);
  const [draftIds, setDraftIds] = useState<string[] | null>(selectedIds);
  const selected = new Set(draftIds ?? photos.map(photo => photo.id));
  const selectedCount = photos.filter(photo => selected.has(photo.id)).length;
  const choices =
    kind === "interval"
      ? BODY_FRAME_VIDEO_INTERVALS
      : kind === "quality"
        ? BODY_FRAME_VIDEO_QUALITIES
        : kind === "ratio"
          ? BODY_FRAME_VIDEO_RATIOS
          : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <Pressable accessibilityRole="button"
              <Text style={{ color: palette.inverse }}>적용</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingRoot: {
    flex: 1
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    maxWidth: bodyFrameDesign.contentMaxWidth,
    alignSelf: "center",
    maxHeight: "90%",
    padding: 16,
    gap: 16,
    borderTopLeftRadius: bodyFrameDesign.bottomSheetRadius,
    borderTopRightRadius: bodyFrameDesign.bottomSheetRadius
  },
  title: { fontSize: 20, fontWeight: "600" },
  orderNotice: { fontSize: 12, lineHeight: 18 },
  overlaySection: { gap: 10 },
  groupLabel: { marginTop: 4, fontSize: 12, fontWeight: "600" },
  overlayChoiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  overlayChoice: {
    minWidth: "47%",
    minHeight: bodyFrameDesign.minTouchSize,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10
  },
  overlayInput: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14
  },
  example: { fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 12 },
  action: { minHeight: bodyFrameDesign.minTouchSize, paddingHorizontal: 12, justifyContent: "center" },
  photoList: { flexGrow: 0, flexShrink: 1 },
  photoRow: { gap: 8 },
  photo: { width: "31%", aspectRatio: 3 / 4, borderWidth: 2, borderRadius: 8, overflow: "hidden", marginBottom: 8 },
  photoImage: { width: "100%", height: "100%" },
  photoLabel: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 6, color: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.65)" },
  choices: { gap: 8 },
  choice: { minHeight: bodyFrameDesign.primaryButtonHeight, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  summary: { fontSize: 14 },
  footerButton: { flex: 1, minHeight: bodyFrameDesign.primaryButtonHeight, borderWidth: 1, borderRadius: 8, justifyContent: "center", alignItems: "center" }
});
