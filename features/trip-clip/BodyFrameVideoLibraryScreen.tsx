import { AppText as Text } from "@/components/app-text";
import {
  Feather } from "@expo/vector-icons";
import { Image } from "@/components/private-media-image";
import { router,
  useFocusEffect } from "expo-router";
import { useCallback,
  useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import { deleteMadeVideo, getMadeVideos } from "@/lib/video-library";
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
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

export default function BodyFrameVideoLibraryScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const [videos, setVideos] = useState<MadeVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setVideos(await getMadeVideos());
    } catch {
      setMessage("저장한 영상을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const confirmDelete = (video: MadeVideoItem) => {
    Alert.alert(
      "영상을 삭제할까요?",
      "앱에 저장된 영상 기록이 삭제됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeletingId(video.id);
              try {
                await deleteMadeVideo(video.id);
                await load();
              } catch {
                setMessage("영상을 삭제하지 못했습니다.");
              } finally {
                setDeletingId(null);
              }
            })();
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 12, 20),
            paddingBottom: insets.bottom + 36
          }
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="영상 화면으로 돌아가기"
            onPress={() => router.back()}
            style={[styles.backButton, { borderColor: palette.line }]}
          >
            <Feather name="chevron-left" size={24} color={palette.text} />
          </Pressable>
          <Text style={[styles.pageTitle, { color: palette.text }]}>영상 관리</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <Text style={[styles.pageDetail, { color: palette.muted }]}>
          지금까지 만든 변화 영상을 확인하거나 삭제할 수 있습니다.
        </Text>

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: palette.muted }]}>
            저장한 영상
          </Text>
          <Text style={[styles.summaryValue, { color: palette.text }]}>
            {videos.length}개
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.text} />
          </View>
        ) : videos.length > 0 ? (
          <View style={styles.list}>
            {videos.map((video) => (
              <View
                key={video.id}
                style={[
                  styles.videoCard,
                  {
                    borderColor: palette.line,
                    backgroundColor: palette.surface
                  }
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/video/[id]",
                      params: { id: video.id }
                    })
                  }
                  style={({ pressed }) => [
                    styles.videoMain,
                    pressed && styles.pressed
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
                        contentFit="cover"
                      />
                    ) : (
                      <Feather name="film" size={22} color={palette.muted} />
                    )}
                  </View>
                  <View style={styles.videoCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.videoTitle, { color: palette.text }]}
                    >
                      {video.title}
                    </Text>
                    <Text style={[styles.videoMeta, { color: palette.muted }]}>
                      {formatDate(video.createdAt)}
                    </Text>
                    <Text style={[styles.videoMeta, { color: palette.muted }]}>
                      {formatDuration(video.duration)} · {video.ratio}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={palette.muted} />
                </Pressable>

                <View style={styles.cardActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/video/[id]",
                        params: { id: video.id }
                      })
                    }
                    style={[styles.cardButton, { borderColor: palette.line }]}
                  >
                    <Text style={[styles.cardButtonText, { color: palette.text }]}>
                      상세
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={deletingId === video.id}
                    onPress={() => confirmDelete(video)}
                    style={[
                      styles.cardButton,
                      {
                        borderColor: palette.line,
                        opacity: deletingId === video.id ? 0.45 : 1
                      }
                    ]}
                  >
                    <Text style={[styles.cardButtonText, { color: palette.muted }]}>
                      {deletingId === video.id ? "삭제 중" : "삭제"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyCard, { borderColor: palette.line }]}>
            <Feather name="film" size={24} color={palette.muted} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              저장한 영상이 없습니다.
            </Text>
            <Text style={[styles.emptyDetail, { color: palette.muted }]}>
              영상 화면에서 프로젝트를 선택해 첫 변화 영상을 만들어 보세요.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/video-create")}
              style={[styles.createButton, { backgroundColor: palette.text }]}
            >
              <Text style={[styles.createButtonText, { color: palette.inverse }]}>
                영상 만들기
              </Text>
            </Pressable>
          </View>
        )}

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
  content: {
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    gap: 14
  },
  topBar: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  pageTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  topBarSpacer: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize
  },
  pageDetail: {
    marginBottom: 6,
    fontSize: bodyFrameTypography.body,
    lineHeight: 20
  },
  summaryRow: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  summaryLabel: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "500"
  },
  summaryValue: {
    fontSize: bodyFrameTypography.rowTitle,
    fontWeight: "600"
  },
  loading: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center"
  },
  list: {
    gap: 10
  },
  videoCard: {
    overflow: "hidden",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  videoMain: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10
  },
  pressed: {
    opacity: 0.82
  },
  videoCover: {
    width: 52,
    height: 68,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6
  },
  videoCoverImage: {
    width: "100%",
    height: "100%"
  },
  videoCopy: {
    flex: 1,
    gap: 3
  },
  videoTitle: {
    fontSize: bodyFrameTypography.rowTitle,
    fontWeight: "600"
  },
  videoMeta: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 10
  },
  cardButton: {
    flex: 1,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  cardButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    padding: 22,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  emptyTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  emptyDetail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    textAlign: "center"
  },
  createButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    marginTop: 4,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  createButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  },
  message: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    textAlign: "center"
  }
});
