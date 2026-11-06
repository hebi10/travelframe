import { AppText as Text } from "@/components/app-text";
import {
  Feather } from "@expo/vector-icons";
import { Image } from "@/components/private-media-image";
import { router,
  useFocusEffect } from "expo-router";
import { useCallback,
  useMemo,
  useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign, bodyFrameTypography, getBodyFrameControlColors } from "@/constants/app-theme";
import {
  getBodyProjectPhotos,
  getBodyProjectProgressSummary,
  selectActiveBodyProject
} from "@/lib/body-frame-camera-project";
import { getLastActiveProjectId, setLastActiveProjectId } from "@/lib/body-project-preferences";
import { getBodyProjects } from "@/lib/body-project-library";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
import { getPhotos } from "@/lib/photo-library";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import {
  getGuestWeeklyVideoExportUsage,
  type WeeklyVideoExportUsage
} from "@/lib/video-export-quota";
import { getMadeVideos } from "@/lib/video-library";
import type { BodyProject } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";
import type { MadeVideoItem } from "@/types/video";

const formatDuration = (seconds: number) =>
  seconds < 60
    ? `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)}초`
    : `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));

export default function BodyFrameVideoHomeScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const { primaryBackground: primaryColor, primaryText: primaryTextColor } =
    getBodyFrameControlColors(palette);
  const { isLoggedIn, subscription } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const [projects, setProjects] = useState<BodyProject[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videos, setVideos] = useState<MadeVideoItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [guestUsage, setGuestUsage] = useState<WeeklyVideoExportUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [storedProjects, storedPhotos, storedVideos, lastActiveProjectId, nextGuestUsage] =
        await Promise.all([
          getBodyProjects(),
          getPhotos(),
          getMadeVideos(),
          getLastActiveProjectId(),
          isLoggedIn
            ? Promise.resolve(null)
            : getGuestWeeklyVideoExportUsage(planEntitlements.weeklyVideoExportLimit)
        ]);

      const visibleProjects = storedProjects.filter((project) => !project.archived);
      const selectedProject = selectActiveBodyProject(
        visibleProjects,
        lastActiveProjectId
      );
      setProjects(visibleProjects);
      setPhotos(storedPhotos);
      setVideos(storedVideos);
      setActiveProjectId(selectedProject?.id ?? null);
      setGuestUsage(nextGuestUsage);
    } catch {
      setMessage("영상 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, planEntitlements.weeklyVideoExportLimit]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeProject =
    projects.find((project) => project.id === activeProjectId) ??
    projects[0] ??
    null;

  const startVideo = useCallback(
    async (project?: BodyProject | null) => {
      const target = project ?? activeProject;
      if (!target) {
        setMessage("영상으로 만들 프로젝트가 없습니다.");
        return;
      }

      await setLastActiveProjectId(target.id);
      router.push("/video-create");
    },
    [activeProject]
  );

  const recentVideos = videos.slice(0, 3);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.text} />
        <Text style={[styles.centerDetail, { color: palette.muted }]}>
          영상 정보를 불러오는 중입니다.
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
          <Text style={[styles.pageTitle, { color: palette.text }]}>영상</Text>
          <Text style={[styles.pageDetail, { color: palette.muted }]}>
            프로젝트로 변화 영상을 만들고 저장한 영상을 관리합니다.
          </Text>
        </View>

        <View
          style={[
            styles.heroCard,
            {
              borderColor: palette.line,
              backgroundColor: palette.surface
            }
          ]}
        >
          <View style={styles.heroHeader}>
            <View style={[styles.heroIllustrationFrame, { backgroundColor: palette.surfaceStrong }]}>
              <Image
                source={require("../../assets/ui/illustrations/feature-video.png")}
                style={styles.heroIllustration}
                contentFit="contain"
                accessible={false}
              />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, { color: palette.text }]}>
                변화 영상 만들기
              </Text>
              <Text style={[styles.heroDetail, { color: palette.muted }]}>
                {activeProject
                  ? `${activeProject.name} 프로젝트의 기록으로 영상을 만듭니다.`
                  : "먼저 프로젝트를 만들어 주세요."}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!activeProject}
            accessibilityState={{ disabled: !activeProject }}
            onPress={() => void startVideo()}
            style={[
              styles.primaryButton,
              {
                backgroundColor: primaryColor,
                opacity: activeProject ? 1 : 0.4
              }
            ]}
          >
            <Feather name="play" size={16} color={primaryTextColor} />
            <Text style={[styles.primaryButtonText, { color: primaryTextColor }]}>
              영상 만들기
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/video-library")}
            style={[styles.secondaryButton, { borderColor: palette.line }]}
          >
            <Feather name="film" size={16} color={palette.text} />
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
              영상 관리
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.policyRow,
            {
              borderColor: palette.line,
              backgroundColor: palette.background
            }
          ]}
        >
          <Feather name="info" size={16} color={palette.muted} />
          <Text style={[styles.policyText, { color: palette.muted }]}>
            {isLoggedIn
              ? "로그인 사용자는 영상 출력 횟수 제한이 없습니다."
              : `비로그인 사용자는 주 1회 출력할 수 있습니다. 이번 주 ${guestUsage?.count ?? 0}/1회 사용`}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>프로젝트</Text>
            <Text style={[styles.sectionCount, { color: palette.muted }]}>
              {projects.length}개
            </Text>
          </View>

          {projects.length > 0 ? (
            <View style={styles.list}>
              {projects.map((project) => {
                const summary = getBodyProjectProgressSummary(photos, project);
                const selected = project.id === activeProject?.id;
                const projectPhotos = getBodyProjectPhotos(photos, project.id);
                const coverPhoto =
                  projectPhotos.find((photo) => photo.id === project.coverPhotoId) ??
                  [...projectPhotos].sort(
                    (first, second) => (second.sequence ?? 0) - (first.sequence ?? 0)
                  )[0];
                return (
                  <Pressable
                    key={project.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${project.name} 프로젝트로 영상 만들기`}
                    accessibilityState={{ selected }}
                    onPress={() => void startVideo(project)}
                    style={({ pressed }) => [
                      styles.projectRow,
                      {
                        borderColor: selected ? palette.text : palette.line,
                        backgroundColor: palette.surface,
                        opacity: pressed ? 0.82 : 1
                      }
                    ]}
                  >
                    <View style={[styles.projectIcon, { backgroundColor: palette.surfaceStrong }]}>
                      {coverPhoto ? (
                        <Image
                          source={{ uri: coverPhoto.previewUri ?? coverPhoto.uri }}
                          style={styles.projectCoverImage}
                          contentFit="contain"
                          accessible={false}
                        />
                      ) : (
                        <Feather name="folder" size={20} color={palette.muted} />
                      )}
                    </View>
                    <View style={styles.rowCopy}>
                      <Text
                        numberOfLines={1}
                        style={[styles.rowTitle, { color: palette.text }]}
                      >
                        {project.name}
                      </Text>
                      <Text style={[styles.rowDetail, { color: palette.muted }]}>
                        기록 {summary.photoCount}개 · 예상 {formatDuration(summary.durationSeconds)}
                      </Text>
                    </View>
                    <View style={styles.rowAction}>
                      <Text style={[styles.rowActionText, { color: palette.text }]}>
                        만들기
                      </Text>
                      <Feather name="chevron-right" size={16} color={palette.muted} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={[styles.emptyCard, { borderColor: palette.line }]}>
              <Image
                source={require("../../assets/ui/illustrations/empty-project.png")}
                style={styles.emptyArtwork}
                contentFit="contain"
                accessibilityLabel="프로젝트가 없는 상태"
              />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                프로젝트가 없습니다.
              </Text>
              <Text style={[styles.emptyDetail, { color: palette.muted }]}>
                기록 탭에서 프로젝트를 만든 뒤 영상 제작을 시작할 수 있습니다.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>저장한 영상</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/video-library")}
              style={styles.textButton}
            >
              <Text style={[styles.textButtonText, { color: palette.text }]}>
                전체 보기
              </Text>
            </Pressable>
          </View>

          {recentVideos.length > 0 ? (
            <View style={styles.list}>
              {recentVideos.map((video) => (
                <Pressable
                  key={video.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/video/[id]",
                      params: { id: video.id }
                    })
                  }
                  style={({ pressed }) => [
                    styles.videoRow,
                    {
                      borderColor: palette.line,
                      backgroundColor: palette.surface,
                      opacity: pressed ? 0.82 : 1
                    }
                  ]}
                >
                  <View
                    style={[
                      styles.videoCover,
                      { backgroundColor: palette.surfaceStrong }
                    ]}
                  >
                    {video.coverUri ? (
                      <Image
                        source={{ uri: video.coverUri }}
                        style={styles.videoCoverImage}
                        contentFit="contain"
                        accessible={false}
                      />
                    ) : (
                      <Feather name="film" size={20} color={palette.muted} />
                    )}
                    <View pointerEvents="none" style={styles.videoPlayIndicator}>
                      <Feather name="play" size={14} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={styles.rowCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.rowTitle, { color: palette.text }]}
                    >
                      {video.title}
                    </Text>
                    <Text style={[styles.rowDetail, { color: palette.muted }]}>
                      {formatDate(video.createdAt)} · {formatDuration(video.duration)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={palette.muted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyCard, { borderColor: palette.line }]}>
              <Image
                source={require("../../assets/ui/illustrations/empty-videos.png")}
                style={styles.emptyArtwork}
                contentFit="contain"
                accessibilityLabel="저장한 영상이 없는 상태"
              />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                아직 저장한 영상이 없습니다.
              </Text>
              <Text style={[styles.emptyDetail, { color: palette.muted }]}>
                프로젝트를 선택해 첫 변화 영상을 만들어 보세요.
              </Text>
            </View>
          )}
        </View>

        {message ? (
          <Text style={[styles.message, { color: palette.muted }]}>{message}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24
  },
  centerDetail: {
    fontSize: bodyFrameTypography.body
  },
  content: {
    width: "100%",
    maxWidth: bodyFrameDesign.contentMaxWidth,
    alignSelf: "center",
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    gap: 12
  },
  header: {
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
  heroCard: {
    gap: 8,
    padding: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  heroIllustrationFrame: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: bodyFrameDesign.cardRadius
  },
  heroIllustration: {
    width: 64,
    height: 64
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5
  },
  heroTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  heroDetail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18
  },
  primaryButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  primaryButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  },
  secondaryButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  secondaryButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  policyRow: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  policyText: {
    flex: 1,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  section: {
    gap: 12
  },
  sectionHeader: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  sectionCount: {
    fontSize: bodyFrameTypography.caption
  },
  textButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 4
  },
  textButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  list: {
    gap: 8
  },
  projectRow: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  projectIcon: {
    width: 54,
    height: 64,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: bodyFrameDesign.cardRadius
  },
  projectCoverImage: {
    width: "100%",
    height: "100%"
  },
  rowCopy: {
    flex: 1,
    gap: 4
  },
  rowTitle: {
    fontSize: bodyFrameTypography.rowTitle,
    fontWeight: "600"
  },
  rowDetail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  rowAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  rowActionText: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  videoRow: {
    minHeight: 94,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  videoCover: {
    width: 60,
    height: 78,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: bodyFrameDesign.cardRadius
  },
  videoPlayIndicator: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 12
  },
  videoCoverImage: {
    width: "100%",
    height: "100%"
  },
  emptyArtwork: {
    width: 88,
    height: 88,
    alignSelf: "center"
  },
  emptyCard: {
    gap: 6,
    padding: 16,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  emptyTitle: {
    fontSize: bodyFrameTypography.rowTitle,
    fontWeight: "600"
  },
  emptyDetail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18
  },
  message: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    textAlign: "center"
  }
});
