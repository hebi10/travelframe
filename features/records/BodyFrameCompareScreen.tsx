import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "@/components/app-text";
import { Image } from "@/components/private-media-image";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { getBodyFrameComparisonPhotos } from "@/lib/body-frame-photo-compare";
import { getBodyProjectById } from "@/lib/body-project-library";
import { getPhotos } from "@/lib/photo-library";
import { useAppAppearance } from "@/lib/app-appearance";
import type { PhotoItem } from "@/types/photo";

const clamp = (value: number) => Math.min(0.9, Math.max(0.1, value));

export default function BodyFrameCompareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === "string" ? id : "";
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [divider, setDivider] = useState(0.5);
  const dividerRef = useRef(0.5);
  const gestureStartRef = useRef(0.5);
  const widthRef = useRef(0);

  const comparison = useMemo(
    () => getBodyFrameComparisonPhotos(photos, projectId),
    [photos, projectId]
  );
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
          { paddingTop: Math.max(insets.top + 16, 24), paddingBottom: insets.bottom + 28 }
        ]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로젝트로 돌아가기"
            style={[styles.backButton, { borderColor: palette.line }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: palette.text }}>‹ 돌아가기</Text>
          </Pressable>
          <Text style={[styles.heading, { color: palette.text }]}>전후 사진 비교</Text>
        </View>

        {projectName ? (
          <Text style={[styles.projectName, { color: palette.muted }]}>{projectName}</Text>
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
                첫 사진 · #{comparison.before.sequence}
              </Text>
              <Text style={[styles.label, { color: palette.text }]}>
                마지막 사진 · #{comparison.after.sequence}
              </Text>
            </View>
            <View
              style={[styles.comparison, { borderColor: palette.line, backgroundColor: palette.surface }]}
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
                contentFit="cover"
                accessibilityLabel="마지막 사진"
              />
              <View style={[styles.clippedBefore, { width: width * divider }]}>
                <Image
                  source={{ uri: comparison.before.uri }}
                  style={{ width, height: "100%" }}
                  contentFit="cover"
                  accessibilityLabel="첫 사진"
                />
              </View>
              <View
                pointerEvents="none"
                style={[styles.divider, { left: width * divider - 1 }]}
              />
            </View>
            <View style={styles.dateLabels}>
              <Text style={[styles.date, { color: palette.muted }]}>
                {formatDate(comparison.before)}
              </Text>
              <Text style={[styles.date, { color: palette.muted }]}>
                {formatDate(comparison.after)}
              </Text>
            </View>
            <Text style={[styles.hint, { color: palette.muted }]}>
              화면을 좌우로 드래그하면 두 사진을 비교할 수 있습니다.
            </Text>
            <View style={styles.positions}>
              {[0.25, 0.5, 0.75].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`첫 사진 표시 비율 ${Math.round(value * 100)}%`}
                  accessibilityState={{ selected: Math.abs(divider - value) < 0.01 }}
                  onPress={() => changeDivider(value)}
                  style={[
                    styles.positionButton,
                    {
                      borderColor: Math.abs(divider - value) < 0.01 ? palette.text : palette.line,
                      backgroundColor: palette.surface
                    }
                  ]}
                >
                  <Text style={[styles.positionText, { color: palette.text }]}>
                    {Math.round(value * 100)}%
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: bodyFrameDesign.horizontalPadding, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  heading: { fontSize: bodyFrameTypography.sectionTitle, fontWeight: "600" },
  projectName: { fontSize: bodyFrameTypography.body },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  label: { fontSize: bodyFrameTypography.caption },
  comparison: {
    width: "100%",
    aspectRatio: 3 / 4,
    overflow: "hidden",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  clippedBefore: { position: "absolute", top: 0, left: 0, height: "100%", overflow: "hidden" },
  divider: { position: "absolute", top: 0, width: 2, height: "100%", backgroundColor: "#FFFFFF" },
  dateLabels: { flexDirection: "row", justifyContent: "space-between" },
  date: { fontSize: bodyFrameTypography.caption },
  hint: { textAlign: "center", fontSize: bodyFrameTypography.caption },
  positions: { flexDirection: "row", gap: 8 },
  positionButton: {
    flex: 1,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  positionText: { fontSize: bodyFrameTypography.body, fontWeight: "600" },
  emptyText: { marginTop: 24, textAlign: "center", fontSize: bodyFrameTypography.body }
});
