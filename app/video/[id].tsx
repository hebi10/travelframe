import { Image } from "expo-image";
import { Stack, router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdBanner } from "@/components/ad-banner";
import { colors, controls, spacing, typography } from "@/constants/app-theme";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { getMadeVideoById } from "@/lib/video-library";
import type { MadeVideoItem } from "@/types/video";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
};

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + spacing.screen, spacing.screen);
  const [video, setVideo] = useState<MadeVideoItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const videoSource = video?.uri || null;
  const hasPlayableVideoSource = Boolean(videoSource);

  const loadVideo = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const storedVideo = await getMadeVideoById(id);
      setVideo(storedVideo);
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "영상을 불러오지 못했습니다."));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadVideo();
    }, [loadVideo])
  );

  const headerTitle = video?.title ?? "만든 영상";

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "만든 영상" }} />
        <View style={styles.centerScreen}>
          <ActivityIndicator color={colors.text} />
        </View>
      </>
    );
  }

  if (!video) {
    return (
      <>
        <Stack.Screen options={{ title: "만든 영상" }} />
        <View style={styles.centerScreen}>
          <Text selectable style={styles.emptyTitle}>
            영상을 찾을 수 없습니다.
          </Text>
          <Pressable style={styles.darkButton} onPress={() => router.replace("/studio")}>
            <Text selectable={false} style={styles.darkButtonText}>
              편집으로 돌아가기
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSafePadding }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View
          style={[styles.videoFrame, { aspectRatio: video.ratio === "16:9" ? 16 / 9 : 9 / 16 }]}
        >
          {hasPlayableVideoSource ? (
            <VideoPlayerFrame source={videoSource as string} />
          ) : (
            <View style={styles.videoUnavailable}>
              <Text selectable style={styles.videoUnavailableText}>
                영상을 재생할 파일을 찾지 못했습니다.
              </Text>
              <Pressable
                style={styles.lightButton}
                onPress={() => router.replace("/studio?tab=works" as Href)}
              >
                <Text selectable={false} style={styles.lightButtonText}>
                  보관함으로 돌아가기
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.header}>
          <Text selectable style={styles.eyebrow}>
            만든 영상
          </Text>
          <Text selectable style={styles.title}>
            {video.title}
          </Text>
          <Text selectable style={styles.detail}>
            {formatDate(video.createdAt)}
          </Text>
        </View>

        <View style={styles.metaPanel}>
          <MetaRow label="비율" value={video.ratio} />
          <MetaRow label="길이" value={formatDuration(video.duration)} />
          <MetaRow label="사진" value={`${video.photoIds.length}장`} />
          <MetaRow label="음악" value={video.musicLabel} />
        </View>

        {video.coverUri ? (
          <Image source={{ uri: video.coverUri }} style={styles.coverImage} contentFit="cover" />
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.darkButton}
            onPress={() => router.push(`/trip-clip?videoId=${video.id}` as Href)}
          >
            <Text selectable={false} style={styles.darkButtonText}>
              다시 편집하기
            </Text>
          </Pressable>
          <Pressable style={styles.lightButton} onPress={() => router.back()}>
            <Text selectable={false} style={styles.lightButtonText}>
              돌아가기
            </Text>
          </Pressable>
          {message ? (
            <Text selectable style={styles.message}>
              {message}
            </Text>
          ) : null}
        </View>
        <AdBanner placement="video_detail" compact />
      </ScrollView>
    </>
  );
}

function VideoPlayerFrame({ source }: { source: string }) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
  });

  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      useExoShutter
    />
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text selectable style={styles.metaLabel}>
        {label}
      </Text>
      <Text selectable style={styles.metaValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    gap: spacing.section,
    padding: spacing.screen
  },
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: spacing.screen,
    backgroundColor: colors.background
  },
  videoFrame: {
    width: "100%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.ink
  },
  video: {
    width: "100%",
    height: "100%"
  },
  videoUnavailable: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: spacing.screen
  },
  videoUnavailableText: {
    color: colors.inverse,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0
  },
  header: {
    gap: 8
  },
  eyebrow: {
    color: colors.muted,
    fontSize: typography.eyebrow,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    lineHeight: 34,
    letterSpacing: 0
  },
  detail: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 20,
    letterSpacing: 0
  },
  metaPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  metaRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  metaLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "700",
    letterSpacing: 0
  },
  metaValue: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  coverImage: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  actions: {
    gap: 10
  },
  darkButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  darkButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  lightButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  lightButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  message: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  }
});
