import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "@/components/app-text";
import { Image } from "@/components/private-media-image";
import { bodyFrameDesign, bodyFrameTypography, getBodyFrameControlColors } from "@/constants/app-theme";
import { getBodyFrameComparisonCandidates, getBodyFrameComparisonPhotos, selectBodyFrameComparisonPhotos } from "@/lib/body-frame-photo-compare";
import { getBodyProjectById } from "@/lib/body-project-library";
import { getPhotos } from "@/lib/photo-library";
import { useAppAppearance } from "@/lib/app-appearance";
import type { PhotoItem } from "@/types/photo";

const clamp = (value: number) => Math.min(0.9, Math.max(0.1, value));
type ComparisonMode = "slider" | "side-by-side" | "overlay";
const comparisonModes: { id: ComparisonMode; label: string }[] = [
  { id: "slider", label: "슬라이더" },
  { id: "side-by-side", label: "나란히" },
  { id: "overlay", label: "겹쳐보기" }
];

export default function BodyFrameCompareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === "string" ? id : "";
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const { selected: controlColor, primaryText: controlTextColor } =
    getBodyFrameControlColors(palette);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [divider, setDivider] = useState(0.5);
  const dividerRef = useRef(0.5);
  const gestureStartRef = useRef(0.5);
  const widthRef = useRef(0);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("slider");
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSide, setPickerSide] = useState<"before" | "after">("before");
  const [draftBeforeId, setDraftBeforeId] = useState<string | null>(null);
  const [draftAfterId, setDraftAfterId] = useState<string | null>(null);
  const [chosenBeforeId, setChosenBeforeId] = useState<string | null>(null);
  const [chosenAfterId, setChosenAfterId] = useState<string | null>(null);
  const candidates = useMemo(
    () => getBodyFrameComparisonCandidates(photos, projectId),
    [photos, projectId]
  );
  const defaultComparison = useMemo(
    () => getBodyFrameComparisonPhotos(photos, projectId),
    [photos, projectId]
  );
  const comparison = useMemo(
    () => chosenBeforeId && chosenAfterId
      ? selectBodyFrameComparisonPhotos(photos, projectId, chosenBeforeId, chosenAfterId)
      : defaultComparison,
    [photos, projectId, chosenBeforeId, chosenAfterId, defaultComparison]
  );
  const openPicker = useCallback(() => {
    setDraftBeforeId(comparison?.before.id ?? null);
    setDraftAfterId(comparison?.after.id ?? null);
    setPickerSide("before");
    setPickerOpen(true);
  }, [comparison]);
  const applySelection = useCallback(() => {
    if (!draftBeforeId || !draftAfterId ||
        !selectBodyFrameComparisonPhotos(photos, projectId, draftBeforeId, draftAfterId)) return;
    setChosenBeforeId(draftBeforeId);
    setChosenAfterId(draftAfterId);
    setPickerOpen(false);
  }, [photos, projectId, draftBeforeId, draftAfterId]);
  const changeDivider = useCallback((value: number) => {
    dividerRef.current = clamp(value);
    setDivider(dividerRef.current);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gestureStartRef.current = dividerRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          if (widthRef.current > 0) {
            changeDivider(gestureStartRef.current + gesture.dx / widthRef.current);
          }
        }
      }),
    [changeDivider]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      changeDivider(0.5);
      setChosenBeforeId(null);
      setChosenAfterId(null);
      setPickerOpen(false);

      void Promise.all([getBodyProjectById(projectId), getPhotos()])
        .then(([project, storedPhotos]) => {
          if (!active) return;
          setProjectName(project?.name ?? null);
          setPhotos(storedPhotos);
        })
        .catch(() => {
          if (active) setError("비교할 사진을 불러오지 못했습니다.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [projectId, changeDivider])
  );

  const formatDate = (photo: PhotoItem) => {
    const date = new Date(photo.createdAt);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ko-KR");
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 8, 16), paddingBottom: insets.bottom + 28 }
        ]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로젝트로 돌아가기"
            style={[styles.backButton, { borderColor: palette.line }]}
            onPress={() => router.back()}
          >
            <Feather name="chevron-left" size={20} color={palette.text} />
          </Pressable>
          <Text style={[styles.heading, { color: palette.text }]}>전후 사진 비교</Text>
        </View>

        {projectName ? (
          <Text style={[styles.projectName, { color: palette.muted }]}>{projectName}</Text>
        ) : null}

        {!loading && candidates.length >= 2 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="비교할 사진 두 장 선택"
            onPress={openPicker}
            style={[styles.pickPhotosButton, { borderColor: palette.line, backgroundColor: palette.surface }]}
          >
            <Feather name="image" size={bodyFrameDesign.iconSize} color={palette.text} />
            <Text style={{ color: palette.text }}>비교 사진 선택</Text>
          </Pressable>
        ) : null}

        {loading ? (
          <ActivityIndicator color={palette.text} />
        ) : error || !comparison ? (
          <Text style={[styles.emptyText, { color: palette.muted }]}>
            {error ?? "비교할 사진이 2장 이상 필요합니다."}
          </Text>
        ) : (
          <>
            <View style={styles.labels}>
              <Text style={[styles.label, { color: palette.text }]}>
                이전 · #{comparison.before.sequence}
              </Text>
              <Text style={[styles.label, { color: palette.text }]}>
                현재 · #{comparison.after.sequence}
              </Text>
            </View>
            <View style={styles.modeTabs} accessibilityLabel="사진 비교 방식">
              {comparisonModes.map(option => (
                <Pressable
                  key={option.id}
                  accessibilityRole="tab"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: comparisonMode === option.id }}
                  onPress={() => setComparisonMode(option.id)}
                  style={[
                    styles.modeTab,
                    { borderColor: comparisonMode === option.id ? controlColor : palette.line,
                      backgroundColor: comparisonMode === option.id ? controlColor : palette.surface }
                  ]}
                >
                  <Text style={{ color: comparisonMode === option.id ? controlTextColor : palette.text }}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {comparisonMode === "slider" ? (
            <View
              style={[styles.comparison, { borderColor: palette.line, backgroundColor: palette.surface }]}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="첫 사진 표시 비율"
              accessibilityValue={{ min: 10, max: 90, now: Math.round(divider * 100), text: `${Math.round(divider * 100)}%` }}
              accessibilityActions={[
                { name: "increment", label: "첫 사진 표시 비율 늘리기" },
                { name: "decrement", label: "첫 사진 표시 비율 줄이기" }
              ]}
              onAccessibilityAction={({ nativeEvent }) => {
                if (nativeEvent.actionName === "increment") changeDivider(divider + 0.1);
                if (nativeEvent.actionName === "decrement") changeDivider(divider - 0.1);
              }}
              onLayout={(event) => {
                const nextWidth = event.nativeEvent.layout.width;
                widthRef.current = nextWidth;
                setWidth(nextWidth);
              }}
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: comparison.after.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                accessibilityLabel="마지막 사진"
              />
              <View style={[styles.clippedBefore, { width: width * divider }]}>
                <Image
                  source={{ uri: comparison.before.uri }}
                  style={{ width, height: "100%" }}
                  contentFit="contain"
                  accessibilityLabel="첫 사진"
                />
              </View>
              <View
                pointerEvents="none"
                style={[styles.divider, { left: width * divider - 1 }]}
              >
                <View style={styles.dividerHandle}>
                  <Feather name="chevron-left" size={16} color="#111111" />
                  <Feather name="chevron-right" size={16} color="#111111" />
                </View>
              </View>
            </View>
            ) : comparisonMode === "side-by-side" ? (
              <View style={[styles.sideBySide, { borderColor: palette.line }]}>
                {[{ photo: comparison.before, label: "이전" }, { photo: comparison.after, label: "현재" }].map(item => (
                  <View key={item.photo.id} style={[styles.sidePhoto, { backgroundColor: palette.surface }]}>
                    <Image
                      source={{ uri: item.photo.uri }}
                      style={styles.sideImage}
                      contentFit="contain"
                      accessibilityLabel={item.label + " 사진"}
                    />
                    <Text style={[styles.sideCaption, { color: palette.text }]}>
                      {item.label} · #{item.photo.sequence}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <View style={[styles.comparison, { borderColor: palette.line, backgroundColor: palette.surface }]}>
                  <Image
                    source={{ uri: comparison.after.uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    accessibilityLabel="현재 사진"
                  />
                  <Image
                    source={{ uri: comparison.before.uri }}
                    style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
                    contentFit="contain"
                    accessibilityLabel="겹쳐진 이전 사진"
                  />
                </View>
                <View style={styles.positions}>
                  {[0.25, 0.5, 0.75].map(value => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`이전 사진 불투명도 ${Math.round(value * 100)}%`}
                      accessibilityState={{ selected: overlayOpacity === value }}
                      onPress={() => setOverlayOpacity(value)}
                      style={[styles.positionButton, {
                        borderColor: overlayOpacity === value ? controlColor : palette.line,
                        backgroundColor: overlayOpacity === value ? controlColor : palette.surface
                      }]}
                    >
                      <Text style={{ color: overlayOpacity === value ? controlTextColor : palette.text }}>
                        {Math.round(value * 100)}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <View style={styles.dateLabels}>
              <Text style={[styles.date, { color: palette.muted }]}>
                {formatDate(comparison.before)}
              </Text>
              <Text style={[styles.date, { color: palette.muted }]}>
                {formatDate(comparison.after)}
              </Text>
            </View>
            <Text style={[styles.hint, { color: palette.muted }]}>
              {comparisonMode === "slider"
                ? "구분선을 좌우로 움직여 전후 사진을 비교하세요."
                : comparisonMode === "side-by-side"
                  ? "두 사진을 나란히 확인하세요."
                  : "이전 사진의 불투명도를 바꾸어 비교하세요."}
            </Text>

          </>
        )}
      </ScrollView>
      {!loading && !error && comparison && comparisonMode === "slider" ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: palette.chrome,
              borderColor: palette.line,
              paddingBottom: Math.max(insets.bottom, 12)
            }
          ]}
        >
          <View style={styles.positions}>
            {[0.25, 0.5, 0.75].map((value) => {
              const selected = Math.abs(divider - value) < 0.01;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`첫 사진 표시 비율 ${Math.round(value * 100)}%`}
                  accessibilityState={{ selected }}
                  onPress={() => changeDivider(value)}
                  style={[
                    styles.positionButton,
                    {
                      borderColor: selected ? controlColor : palette.line,
                      backgroundColor: selected ? controlColor : palette.surface
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.positionText,
                      { color: selected ? controlTextColor : palette.text }
                    ]}
                  >
                    {Math.round(value * 100)}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={[styles.pickerSheet, { backgroundColor: palette.surface, borderColor: palette.line, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.pickerTitleRow}>
              <Text style={[styles.pickerTitle, { color: palette.text }]}>비교할 사진 선택</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="사진 선택 취소"
                onPress={() => setPickerOpen(false)} style={styles.pickerClose}>
                <Feather name="x" size={20} color={palette.text} />
              </Pressable>
            </View>
            <View style={styles.modeTabs}>
              {(["before", "after"] as const).map(side => (
                <Pressable
                  key={side}
                  accessibilityRole="button"
                  accessibilityLabel={side === "before" ? "이전 사진 선택" : "현재 사진 선택"}
                  accessibilityState={{ selected: pickerSide === side }}
                  onPress={() => setPickerSide(side)}
                  style={[styles.modeTab, {
                    borderColor: pickerSide === side ? controlColor : palette.line,
                    backgroundColor: pickerSide === side ? controlColor : palette.surface
                  }]}
                >
                  <Text style={{ color: pickerSide === side ? controlTextColor : palette.text }}>
                    {side === "before" ? "이전" : "현재"} · #{side === "before"
                      ? candidates.find(photo => photo.id === draftBeforeId)?.sequence ?? "?"
                      : candidates.find(photo => photo.id === draftAfterId)?.sequence ?? "?"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FlatList
              data={candidates}
              keyExtractor={item => item.id}
              numColumns={2}
              contentContainerStyle={styles.pickerList}
              columnWrapperStyle={styles.pickerRow}
              renderItem={({ item }) => {
                const selected = pickerSide === "before" ? draftBeforeId === item.id : draftAfterId === item.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.sequence}번째 사진, ${formatDate(item)}`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      if (pickerSide === "before") {
                        setDraftBeforeId(item.id);
                        setPickerSide("after");
                      } else setDraftAfterId(item.id);
                    }}
                    style={[styles.pickerItem, {
                      borderColor: selected ? controlColor : palette.line
                    }]}
                  >
                    <Image source={{ uri: item.previewUri ?? item.uri }}
                      contentFit="contain" style={styles.pickerImage} accessible={false} />
                    <Text style={[styles.pickerMeta, { color: palette.text }]}>
                      #{item.sequence} · {formatDate(item)}
                    </Text>
                  </Pressable>
                );
              }}
            />
            <View style={styles.pickerActions}>
              <Pressable accessibilityRole="button" onPress={() => setPickerOpen(false)}
                style={[styles.pickerAction, { borderColor: palette.line }]}>
                <Text style={{ color: palette.text }}>취소</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="선택한 사진으로 비교"
                accessibilityState={{ disabled: !selectBodyFrameComparisonPhotos(
                  photos, projectId, draftBeforeId ?? "", draftAfterId ?? "") }}
                disabled={!selectBodyFrameComparisonPhotos(photos, projectId, draftBeforeId ?? "", draftAfterId ?? "")}
                onPress={applySelection}
                style={[styles.pickerAction, {
                  backgroundColor: controlColor,
                  borderColor: controlColor
                }]}>
                <Text style={{ color: controlTextColor }}>적용</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: bodyFrameDesign.contentMaxWidth,
    alignSelf: "center",
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    gap: 8
  },
  header: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  backButton: {
    position: "absolute",
    left: 0,
    top: 0,
    width: bodyFrameDesign.minTouchSize,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  heading: { fontSize: bodyFrameTypography.sectionTitle, fontWeight: "600", textAlign: "center" },
  projectName: { fontSize: bodyFrameTypography.caption, textAlign: "center" },
  labels: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  label: { fontSize: bodyFrameTypography.caption },
  comparison: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    aspectRatio: 3 / 4,
    overflow: "hidden",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  clippedBefore: { position: "absolute", top: 0, left: 0, height: "100%", overflow: "hidden" },
  divider: { position: "absolute", top: 0, width: 2, height: "100%", backgroundColor: "#FFFFFF" },
  dividerHandle: {
    position: "absolute",
    left: -21,
    top: "50%",
    width: 44,
    height: 44,
    marginTop: -22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#171717",
    borderRadius: 22,
    backgroundColor: "#FFFFFF"
  },
  dateLabels: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  date: { fontSize: bodyFrameTypography.caption },
  hint: { textAlign: "center", fontSize: bodyFrameTypography.caption },
  footer: {
    width: "100%",
    borderWidth: bodyFrameDesign.borderWidth,
    paddingTop: 10,
    paddingHorizontal: bodyFrameDesign.horizontalPadding
  },
  positions: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    flexDirection: "row",
    gap: 8
  },
  positionButton: {
    flex: 1,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  positionText: { fontSize: bodyFrameTypography.body, fontWeight: "600" },
  emptyText: { marginTop: 24, textAlign: "center", fontSize: bodyFrameTypography.body },
  pickPhotosButton: { minHeight: 48, maxWidth: 520, width: "100%", alignSelf: "center",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderRadius: 8 },
  modeTabs: { flexDirection: "row", gap: 8, width: "100%", maxWidth: 520, alignSelf: "center" },
  modeTab: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 8,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  sideBySide: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 8,
    maxWidth: 520, width: "100%", alignSelf: "center", padding: 8, minHeight: 280 },
  sidePhoto: { flex: 1, minWidth: 0, borderRadius: 8, padding: 4, gap: 8 },
  sideImage: { width: "100%", aspectRatio: 3 / 4 },
  sideCaption: { fontSize: 12, textAlign: "center" },
  pickerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
  pickerSheet: { maxHeight: "86%", minHeight: 380, borderWidth: 1,
    borderRadius: 12, paddingTop: 18, paddingHorizontal: 16, gap: 12 },
  pickerTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerTitle: { fontSize: 18, fontWeight: "600" },
  pickerClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pickerList: { paddingBottom: 12, gap: 8 },
  pickerRow: { gap: 8 },
  pickerItem: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 6, minWidth: 0 },
  pickerImage: { width: "100%", aspectRatio: 3 / 4 },
  pickerMeta: { fontSize: 12, paddingTop: 6 },
  pickerActions: { flexDirection: "row", gap: 8 },
  pickerAction: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 8,
    alignItems: "center", justifyContent: "center" }
});
