import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text, AppTextInput as TextInput } from "@/components/app-text";
import { bodyFrameDesign } from "@/constants/app-theme";
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
    <Modal transparent visible={currentPosition !== null} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior="height">
        <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.line, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              <Text style={[styles.title, { color: palette.text }]}>사진 순번 이동</Text>
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
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: targetIndex === null }}
                disabled={targetIndex === null}
                style={[styles.button, { backgroundColor: palette.text, opacity: targetIndex === null ? 0.5 : 1 }]}
                onPress={() => { if (targetIndex !== null) onMove(targetIndex); }}
              >
                <Text style={{ color: palette.inverse }}>이 순번으로 이동</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.button} onPress={onClose}>
                <Text style={{ color: palette.text }}>취소</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
  sheet: { width: "100%", maxWidth: bodyFrameDesign.contentMaxWidth, maxHeight: "100%", alignSelf: "center", padding: 16, borderWidth: bodyFrameDesign.borderWidth },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 12 },
  description: { fontSize: 14, marginBottom: 16 },
  input: { minHeight: bodyFrameDesign.primaryButtonHeight, borderWidth: bodyFrameDesign.borderWidth, padding: 12, marginBottom: 12 },
  button: { minHeight: bodyFrameDesign.primaryButtonHeight, alignItems: "center", justifyContent: "center", padding: 12 }
});
