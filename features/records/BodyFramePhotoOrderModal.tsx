import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/components/private-media-image";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import type { PhotoItem } from "@/types/photo";

const GRID_GAP = 6;
const LONG_PRESS_MS = 320;

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  if (fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

function SortablePhotoTile({
  photo,
  index,
  count,
  columns,
  tileWidth,
  onDrop
}: {
  photo: PhotoItem;
  index: number;
  count: number;
  columns: number;
  tileWidth: number;
  onDrop: (fromIndex: number, toIndex: number) => void;
}) {
  const { palette } = useAppAppearance();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const tileHeight = tileWidth * (4 / 3);
  const cellWidth = tileWidth + GRID_GAP;
  const cellHeight = tileHeight + GRID_GAP;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_MS)
        .onStart(() => {
          dragging.value = true;
        })
        .onUpdate((event) => {
          translateX.value = event.translationX;
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          const startRow = Math.floor(index / columns);
          const startColumn = index % columns;
          const rowDelta = Math.round(event.translationY / cellHeight);
          const columnDelta = Math.round(event.translationX / cellWidth);
          const targetRow = Math.max(
            0,
            Math.min(Math.ceil(count / columns) - 1, startRow + rowDelta)
          );
          const targetColumn = Math.max(
            0,
            Math.min(columns - 1, startColumn + columnDelta)
          );
          const targetIndex = Math.max(
            0,
            Math.min(count - 1, targetRow * columns + targetColumn)
          );

          if (targetIndex !== index) {
            runOnJS(onDrop)(index, targetIndex);
          }
        })
        .onFinalize(() => {
          dragging.value = false;
          translateX.value = withTiming(0, { duration: 140 });
          translateY.value = withTiming(0, { duration: 140 });
        }),
    [
      cellHeight,
      cellWidth,
      columns,
      count,
      dragging,
      index,
      onDrop,
      translateX,
      translateY
    ]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    zIndex: dragging.value ? 20 : 1,
    opacity: dragging.value ? 0.92 : 1,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: withTiming(dragging.value ? 1.06 : 1, { duration: 120 }) }
    ]
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessibilityRole="adjustable"
        accessibilityLabel={`${index + 1}번째 사진. 길게 누른 뒤 드래그하여 순서를 변경`}
        style={[
          styles.tile,
          {
            width: tileWidth,
            height: tileHeight,
            borderColor: palette.line,
            backgroundColor: palette.surfaceStrong
          },
          animatedStyle
        ]}
      >
        <Image
          source={{ uri: photo.previewUri ?? photo.uri }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={styles.sequenceBadge}>
          <Text style={styles.sequenceText}>{`#${index + 1}`}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function BodyFramePhotoOrderModal({
  visible,
  photos,
  onClose,
  onSave
}: {
  visible: boolean;
  photos: PhotoItem[];
  onClose: () => void;
  onSave: (orderedPhotoIds: string[]) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const [orderedPhotos, setOrderedPhotos] = useState(photos);
  const [gridWidth, setGridWidth] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setOrderedPhotos(photos);
    }
  }, [photos, visible]);

  const columns = gridWidth >= 520 ? 7 : gridWidth >= 420 ? 6 : 5;
  const tileWidth =
    gridWidth > 0
      ? (gridWidth - GRID_GAP * (columns - 1)) / columns
      : 0;

  const handleDrop = useCallback((fromIndex: number, toIndex: number) => {
    setOrderedPhotos((current) => moveItem(current, fromIndex, toIndex));
  }, []);

  const saveOrder = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(orderedPhotos.map((photo) => photo.id));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top + 10, 18),
              borderColor: palette.line
            }
          ]}
        >
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: palette.text }]}>사진 순서 조정</Text>
            <Text style={[styles.detail, { color: palette.muted }]}>
              사진을 길게 누른 뒤 원하는 위치로 드래그하세요. 왼쪽 위가 첫 번째 기록입니다.
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={[styles.secondaryButton, { borderColor: palette.line }]}
              onPress={onClose}
            >
              <Text style={[styles.secondaryText, { color: palette.text }]}>취소</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              accessibilityRole="button"
              style={[
                styles.primaryButton,
                {
                  backgroundColor: palette.text,
                  opacity: saving ? 0.5 : 1
                }
              ]}
              onPress={() => void saveOrder()}
            >
              <Text style={[styles.primaryText, { color: palette.inverse }]}>
                {saving ? "저장 중" : "순서 저장"}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 24, 40) }
          ]}
        >
          <View
            style={styles.grid}
            onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
          >
            {tileWidth > 0
              ? orderedPhotos.map((photo, index) => (
                  <SortablePhotoTile
                    key={photo.id}
                    photo={photo}
                    index={index}
                    count={orderedPhotos.length}
                    columns={columns}
                    tileWidth={tileWidth}
                    onDrop={handleDrop}
                  />
                ))
              : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  header: {
    gap: 12,
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingBottom: 12,
    borderBottomWidth: bodyFrameDesign.borderWidth
  },
  headerCopy: {
    gap: 4
  },
  title: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  detail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  actions: {
    flexDirection: "row",
    gap: 8
  },
  primaryButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  secondaryButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth
  },
  primaryText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  },
  secondaryText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  content: {
    padding: bodyFrameDesign.horizontalPadding
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP
  },
  tile: {
    overflow: "hidden",
    borderWidth: bodyFrameDesign.borderWidth
  },
  image: {
    width: "100%",
    height: "100%"
  },
  sequenceBadge: {
    position: "absolute",
    left: 3,
    bottom: 3,
    minWidth: 22,
    minHeight: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    backgroundColor: "rgba(0,0,0,0.66)"
  },
  sequenceText: {
    color: "#F5F5F5",
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"]
  }
});
