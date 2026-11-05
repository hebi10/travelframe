import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text, AppTextInput as TextInput } from "@/components/app-text";
import { BodyFrameSheetFooter, BodyFrameSheetHandle, BodyFrameSheetHeader } from "@/components/body-frame-sheet";
import { bodyFrameDesign, bodyFrameSheetDesign, bodyFrameTypography } from "@/constants/app-theme";
import { getPhotoPositionIndex } from "@/features/records/photo-order-accessibility";
import { useAppAppearance } from "@/lib/app-appearance";

type PhotoPositionSheetProps = {
  currentPosition: number | null;
  count: number;
  onClose: () => void;
  onMove: (displayIndex: number) => void;
};

export function PhotoPositionSheet({ currentPosition, count, onClose, onMove }: PhotoPositionSheetProps) {
  const { palette } = useAppAppearance();
  const insets = useSafeAreaInsets();
  const [position, setPosition] = useState("");
  useEffect(() => { setPosition(String(currentPosition ?? "")); }, [currentPosition]);
  const targetIndex = getPhotoPositionIndex(position, count);

  return (
    <Modal transparent animationType="slide" visible={currentPosition !== null} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior="height">
        <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 16) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진 순번 이동 닫기"
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
          <View
            style={[
              styles.sheet,
              { backgroundColor: palette.surface, borderColor: palette.line, paddingBottom: Math.max(insets.bottom, 16) }
            ]}
          >
            <BodyFrameSheetHandle />
            <BodyFrameSheetHeader title="사진 순번 이동" onClose={onClose} />
            <ScrollView
              style={styles.contentScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.content}
            >
              <Text style={[styles.description, { color: palette.muted }]}>
                현재 {currentPosition}번째 기록입니다. 이동할 순번을 1부터 {count}까지 입력하세요. 1은 첫 기록입니다.
              </Text>
              <TextInput
                accessibilityLabel={`이동할 사진 순번, 1부터 ${count}까지`}
                value={position}
                onChangeText={setPosition}
                keyboardType="number-pad"
                selectTextOnFocus
                style={[styles.input, { color: palette.text, borderColor: palette.line, backgroundColor: palette.background }]}
              />
            </ScrollView>
            <BodyFrameSheetFooter
              onCancel={onClose}
              onConfirm={() => { if (targetIndex !== null) onMove(targetIndex); }}
              confirmLabel="이 순번으로 이동"
              disabled={targetIndex === null}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: bodyFrameSheetDesign.backdropColor },
  sheet: {
    width: "100%",
    maxWidth: bodyFrameDesign.contentMaxWidth,
    maxHeight: bodyFrameSheetDesign.maxHeight,
    alignSelf: "center",
    padding: bodyFrameDesign.horizontalPadding,
    gap: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.bottomSheetRadius
  },
  contentScroll: { flexShrink: 1, minHeight: 0 },
  content: { gap: 12, paddingBottom: 8 },
  description: { fontSize: bodyFrameTypography.body, lineHeight: 20 },
  input: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius,
    padding: 12,
    fontSize: bodyFrameTypography.body
  }
});
