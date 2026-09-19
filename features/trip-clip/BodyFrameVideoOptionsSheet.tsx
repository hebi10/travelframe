import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import {
  BODY_FRAME_VIDEO_INTERVALS,
  BODY_FRAME_VIDEO_QUALITIES,
  BODY_FRAME_VIDEO_RATIOS,
  getBodyFrameVideoDuration,
  type BodyFrameVideoOptions
} from "@/lib/body-frame-video";
import type { PhotoItem } from "@/types/photo";

export type VideoOptionKind = "photos" | "interval" | "quality" | "ratio";
const titles = { photos: "사진 선택", interval: "사진 간격", quality: "영상 화질", ratio: "화면 비율" };

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
  const choices = kind === "interval" ? BODY_FRAME_VIDEO_INTERVALS
    : kind === "quality" ? BODY_FRAME_VIDEO_QUALITIES : BODY_FRAME_VIDEO_RATIOS;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={[styles.backdrop, { paddingTop: insets.top + 24 }]} onPress={onCancel}>
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={() => undefined}
        >
          <Text style={[styles.title, { color: palette.text }]}>{titles[kind]}</Text>
          {kind === "photos" ? (
            <>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" style={styles.action} onPress={() => setDraftIds(null)}>
                  <Text style={{ color: palette.text }}>전체 선택</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.action} onPress={() => setDraftIds([])}>
                  <Text style={{ color: palette.text }}>전체 해제</Text>
                </Pressable>
              </View>
              <FlatList
                data={photos}
                keyExtractor={photo => photo.id}
                extraData={draftIds}
                numColumns={3}
                style={styles.photoList}
                columnWrapperStyle={styles.photoRow}
                renderItem={({ item }) => {
                  const checked = selected.has(item.id);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${item.sequence ?? ""}번째 사진`}
                      accessibilityState={{ checked }}
                      style={[styles.photo, { borderColor: checked ? palette.text : palette.line }]}
                      onPress={() => setDraftIds(current => {
                        const ids = current ?? photos.map(photo => photo.id);
                        return ids.includes(item.id) ? ids.filter(id => id !== item.id) : [...ids, item.id];
                      })}
                    >
                      <Image source={{ uri: item.previewUri ?? item.uri }} style={styles.photoImage} contentFit="cover" />
                      <Text style={styles.photoLabel}>{checked ? "✓ " : ""}#{item.sequence ?? ""}</Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={<Text style={{ color: palette.muted }}>선택할 사진이 없습니다.</Text>}
              />
            </>
          ) : (
            <View style={styles.choices}>
              {choices.map(choice => {
                const active = draftOptions[kind] === choice;
                return (
                  <Pressable
                    key={choice}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[styles.choice, { borderColor: active ? palette.text : palette.line, backgroundColor: active ? palette.text : palette.background }]}
                    onPress={() => setDraftOptions(current => ({ ...current, [kind]: choice }))}
                  >
                    <Text style={{ color: active ? palette.inverse : palette.text }}>
                      {choice}{kind === "interval" ? "초" : kind === "quality" ? "p" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text style={[styles.summary, { color: palette.muted }]}>
            {selectedCount}장 · 예상 {getBodyFrameVideoDuration(selectedCount, draftOptions.interval)}초
          </Text>
          {kind === "ratio" ? <Text style={{ color: palette.muted }}>사진은 선택한 화면 비율에 맞춰 잘릴 수 있습니다.</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" style={[styles.footerButton, { borderColor: palette.line }]} onPress={onCancel}>
              <Text style={{ color: palette.text }}>취소</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={[styles.footerButton, { backgroundColor: palette.text, borderColor: palette.text }]} onPress={() => onApply(draftOptions, draftIds)}>
              <Text style={{ color: palette.inverse }}>적용</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { maxHeight: "90%", padding: 16, gap: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  title: { fontSize: 20, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 12 },
  action: { minHeight: bodyFrameDesign.minTouchSize, paddingHorizontal: 12, justifyContent: "center" },
  photoList: { flexGrow: 0, flexShrink: 1 },
  photoRow: { gap: 8 },
  photo: { width: "31%", aspectRatio: 9 / 16, borderWidth: 2, borderRadius: 8, overflow: "hidden", marginBottom: 8 },
  photoImage: { width: "100%", height: "100%" },
  photoLabel: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 6, color: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.65)" },
  choices: { gap: 8 },
  choice: { minHeight: bodyFrameDesign.primaryButtonHeight, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  summary: { fontSize: 14 },
  footerButton: { flex: 1, minHeight: bodyFrameDesign.primaryButtonHeight, borderWidth: 1, borderRadius: 8, justifyContent: "center", alignItems: "center" }
});
