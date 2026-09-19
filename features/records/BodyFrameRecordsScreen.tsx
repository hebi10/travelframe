import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import {
  getBodyProjectPhotos,
  getBodyProjectProgressSummary
} from "@/lib/body-frame-camera-project";
import { archiveBodyProject, getBodyProjects } from "@/lib/body-project-library";
import { setLastActiveProjectId } from "@/lib/body-project-preferences";
import { getPhotos } from "@/lib/photo-library";
import { useAppAppearance } from "@/lib/app-appearance";
import type { BodyProject } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

const getProjectCover = (project: BodyProject, photos: PhotoItem[]) => {
  const projectPhotos = getBodyProjectPhotos(photos, project.id);
  if (project.coverPhotoId) {
    const explicit = projectPhotos.find((photo) => photo.id === project.coverPhotoId);
    if (explicit) return explicit;
  }

  return [...projectPhotos].sort((first, second) => {
    const firstSequence = first.sequence ?? 0;
    const secondSequence = second.sequence ?? 0;
    if (firstSequence !== secondSequence) {
      return secondSequence - firstSequence;
    }
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  })[0] ?? null;
};

const formatDuration = (seconds: number) =>
  seconds < 60
    ? `${seconds.toFixed(1)}초`
    : `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;

export default function BodyFrameRecordsScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const [projects, setProjects] = useState<BodyProject[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<BodyProject[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [storedProjects, storedPhotos] = await Promise.all([
        getBodyProjects(),
        getPhotos()
      ]);
      setProjects(storedProjects.filter((project) => !project.archived));
      setArchivedProjects(storedProjects.filter((project) => project.archived));
      setPhotos(storedPhotos);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const cards = useMemo(
    () =>
      projects.map((project) => ({
        project,
        summary: getBodyProjectProgressSummary(photos, project),
        cover: getProjectCover(project, photos)
      })),
    [photos, projects]
  );

  const openProject = useCallback(async (project: BodyProject) => {
    await setLastActiveProjectId(project.id);
    router.push({
      pathname: "/project/[id]",
      params: { id: project.id }
    });
  }, []);

  const restoreProject = useCallback(
    async (project: BodyProject) => {
      await archiveBodyProject(project.id, false);
      await setLastActiveProjectId(project.id);
      await reload();
    },
    [reload]
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.text} />
        <Text style={[styles.emptyDetail, { color: palette.muted }]}>
          프로젝트 기록을 불러오는 중입니다.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 20, 28),
            paddingBottom: insets.bottom + 36
          }
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.pageTitle, { color: palette.text }]}>기록</Text>
            <Text style={[styles.pageDetail, { color: palette.muted }]}>
              프로젝트별 몸의 변화를 한눈에 확인합니다.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={[styles.captureButton, { backgroundColor: palette.text }]}
            onPress={() => router.push("/camera")}
          >
            <Text style={[styles.captureButtonText, { color: palette.inverse }]}>
              촬영하기
            </Text>
          </Pressable>
        </View>

        {cards.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.line
              }
            ]}
          >
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              아직 프로젝트가 없습니다.
            </Text>
            <Text style={[styles.emptyDetail, { color: palette.muted }]}>
              촬영 화면에서 첫 프로젝트를 만들고 같은 위치와 자세로 기록을 시작하세요.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={[styles.primaryButton, { backgroundColor: palette.text }]}
              onPress={() => router.push("/camera")}
            >
              <Text style={[styles.primaryButtonText, { color: palette.inverse }]}>
                첫 프로젝트 만들기
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.projectGrid}>
            {cards.map(({ project, summary, cover }) => {
              const progress = Math.min(
                1,
                summary.photoCount / Math.max(1, summary.targetPhotoCount)
              );
              const progressPercent = Math.round(progress * 100);

              return (
                <Pressable
                  key={project.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${project.name} 프로젝트 열기`}
                  onPress={() => void openProject(project)}
                  style={({ pressed }) => [
                    styles.projectCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.line,
                      opacity: pressed ? 0.82 : 1
                    }
                  ]}
                >
                  <View
                    style={[
                      styles.coverFrame,
                      { backgroundColor: palette.surfaceStrong }
                    ]}
                  >
                    {cover ? (
                      <Image
                        source={{ uri: cover.previewUri ?? cover.uri }}
                        style={styles.coverImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={styles.coverEmpty}>
                        <Text style={[styles.coverEmptyText, { color: palette.faint }]}>
                          첫 기록 전
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.projectCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.projectName, { color: palette.text }]}
                    >
                      {project.name}
                    </Text>
                    <View style={styles.projectStatsRow}>
                      <Text style={[styles.projectMeta, { color: palette.muted }]}>
                        {summary.photoCount} / {summary.targetPhotoCount}장
                      </Text>
                      <Text style={[styles.projectPercent, { color: palette.faint }]}>
                        {progressPercent}%
                      </Text>
                    </View>
                    <Text style={[styles.projectDuration, { color: palette.faint }]}>
                      변화 영상 {formatDuration(summary.durationSeconds)}
                    </Text>
                    <View
                      style={[
                        styles.progressTrack,
                        { backgroundColor: palette.surfaceStrong }
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: palette.text,
                            width: `${progressPercent}%`
                          }
                        ]}
                      />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {archivedProjects.length > 0 ? (
          <View style={styles.archivedSection}>
            <Text style={[styles.archivedTitle, { color: palette.text }]}>
              보관된 프로젝트
            </Text>
            <Text style={[styles.archivedDetail, { color: palette.muted }]}>
              보관한 프로젝트는 촬영 목록에서 숨겨집니다. 필요할 때 다시 복원할 수 있습니다.
            </Text>
            <View style={styles.archivedList}>
              {archivedProjects.map((project) => (
                <View
                  key={project.id}
                  style={[
                    styles.archivedRow,
                    {
                      borderColor: palette.line,
                      backgroundColor: palette.surface
                    }
                  ]}
                >
                  <View style={styles.archivedCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.archivedName, { color: palette.text }]}
                    >
                      {project.name}
                    </Text>
                    <Text style={[styles.archivedMeta, { color: palette.muted }]}>
                      목표 {project.targetPhotoCount}장 · 기준{" "}
                      {project.referenceMode === "first" ? "첫 사진" : "최근 사진"}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.restoreButton, { borderColor: palette.line }]}
                    onPress={() => void restoreProject(project)}
                  >
                    <Text style={[styles.restoreButtonText, { color: palette.text }]}>
                      복원
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

      </ScrollView>

      <AppGuideOverlay tabKey="studio" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    paddingHorizontal: bodyFrameDesign.horizontalPadding
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24
  },
  headerCopy: {
    flex: 1,
    gap: 6
  },
  pageTitle: {
    fontSize: bodyFrameTypography.pageTitle,
    fontWeight: "600"
  },
  pageDetail: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 20
  },
  captureButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  captureButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  projectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  projectCard: {
    width: "48%",
    overflow: "hidden",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  coverFrame: {
    width: "100%",
    aspectRatio: 3 / 4,
    overflow: "hidden"
  },
  coverImage: {
    width: "100%",
    height: "100%"
  },
  coverEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  coverEmptyText: {
    fontSize: bodyFrameTypography.caption,
    textAlign: "center"
  },
  projectCopy: {
    gap: 6,
    padding: 10
  },
  projectName: {
    fontSize: 15,
    fontWeight: "600"
  },
  projectStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  projectMeta: {
    flexShrink: 1,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  projectPercent: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  projectDuration: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  progressTrack: {
    height: 4,
    overflow: "hidden",
    borderRadius: 2
  },
  progressFill: {
    height: "100%",
    borderRadius: 2
  },
  archivedSection: {
    gap: 8,
    marginTop: 28
  },
  archivedTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  archivedDetail: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4
  },
  archivedList: {
    gap: 8
  },
  archivedRow: {
    minHeight: Math.max(64, bodyFrameDesign.minTouchSize),
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8
  },
  archivedCopy: {
    flex: 1,
    gap: 3
  },
  archivedName: {
    fontSize: 14,
    fontWeight: "600"
  },
  archivedMeta: {
    fontSize: 12,
    lineHeight: 17
  },
  restoreButton: {
    minWidth: 58,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8
  },
  restoreButtonText: {
    fontSize: 13,
    fontWeight: "600"
  },
  emptyCard: {
    gap: 12,
    padding: 18,
    borderWidth: 1,
    borderRadius: 8
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600"
  },
  emptyDetail: {
    fontSize: 14,
    lineHeight: 20
  },
  primaryButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginTop: 4
  },
  primaryButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
});
