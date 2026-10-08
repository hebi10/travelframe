import { AppText as Text } from "@/components/app-text";
import {
  Image } from "@/components/private-media-image";
import { Stack,
  router,
  type Href,
  useFocusEffect,
  useLocalSearchParams } from "expo-router";
import { Component,
  type ReactNode,
  useCallback,
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

import { AdBanner } from "@/components/ad-banner";
import {
  bodyFrameDesign,
  bodyFrameTypography,
  colors,
  controls,
  spacing,
  typography
} from "@/constants/app-theme";
import { useAuth } from "@/lib/auth-context";
import { useAppAppearance } from "@/lib/app-appearance";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { getMadeVideoById } from "@/lib/video-library";
import { getVideoAspectRatio } from "@/lib/video-utils";
import type { MadeVideoItem } from "@/types/video";

type ExpoVideoModule = typeof import("expo-video");

const getExpoVideoModule = (): ExpoVideoModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-video") as ExpoVideoModule;
  } catch (error) {
    console.error("영상 재생 모듈을 불러오지 못했습니다.", error);
    return null;
  }
};

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
  const { user } = useAuth();
  const { palette } = useAppAppearance();
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + spacing.screen, spacing.screen);
  const [video, setVideo] = useState<MadeVideoItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [playbackRequested, setPlaybackRequested] = useState(false);
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
      setPlaybackRequested(false);
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

  const showLoginRequiredForVideoCreation = () => {
    Alert.alert(
      "로그인이 필요합니다",
      "동영상 만들기와 다시 편집하기는 로그인 후 사용할 수 있습니다.",
      [
        { text: "닫기", style: "cancel" },
        { text: "로그인하기", onPress: () => router.push("/account" as Href) }
      ]
    );
  };

  const headerTitle = video?.title ?? "만든 영상";

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "만든 영상" }} />
        <View style={[styles.centerScreen, { backgroundColor: palette.background }]}>
          <ActivityIndicator color={palette.text} />
        </View>
      </>
    );
  }

  if (!video) {
    return (
      <>
        <Stack.Screen options={{ title: "만든 영상" }} />
        <View style={[styles.centerScreen, { backgroundColor: palette.background }]}>
          <Text selectable style={[styles.emptyTitle, { color: palette.text }]}>
            영상을 찾을 수 없습니다.
          </Text>
          <Pressable accessibilityRole="button" style={[styles.darkButton, { backgroundColor: palette.text }]} onPress={() => router.replace("/video-library")}>
            <Text selectable={false} style={[styles.darkButtonText, { color: palette.inverse }]}>
              영상 목록으로 돌아가기
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
        style={[styles.screen, { backgroundColor: palette.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSafePadding }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View
          style={[styles.videoFrame, { aspectRatio: getVideoAspectRatio(video.ratio), borderColor: palette.line }]}
        >
          {hasPlayableVideoSource && playbackRequested ? (
            <VideoPlaybackBoundary>
              <VideoPlayerFrame source={videoSource as string} />
            </VideoPlaybackBoundary>
          ) : hasPlayableVideoSource ? (
            <View style={styles.videoPoster}>
              {video.coverUri ? (
                <Image
                  source={{ uri: video.coverUri }}
                  style={styles.videoPosterImage}
                  contentFit="cover"
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                style={styles.videoStartButton}
                onPress={() => setPlaybackRequested(true)}
              >
                <Text selectable={false} style={styles.videoStartButtonText}>
                  영상 재생
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.videoUnavailable}>
              <Text selectable style={styles.videoUnavailableText}>
                영상을 재생할 파일을 찾지 못했습니다.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.lightButton}
                onPress={() => router.replace("/video-library" as Href)}
              >
                <Text selectable={false} style={styles.lightButtonText}>
                  보관함으로 돌아가기
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.header}>
          <Text selectable style={[styles.eyebrow, { color: palette.muted }]}>
            만든 영상
          </Text>
          <Text selectable style={[styles.title, { color: palette.text }]}>
            {video.title}
          </Text>
          <Text selectable style={[styles.detail, { color: palette.muted }]}>
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
          <Image source={{ uri: video.coverUri }} style={[styles.coverImage, { borderColor: palette.line, backgroundColor: palette.surface }]} contentFit="cover" />
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={[styles.darkButton, { backgroundColor: palette.text }]}
            onPress={() => {
              if (!user) {
                showLoginRequiredForVideoCreation();
                return;
              }

              router.push({
                pathname: "/legacy-video-edit",
                params: { videoId: video.id, returnTo: `/video/${video.id}` }
              } as Href);
            }}
          >
            <Text selectable={false} style={[styles.darkButtonText, { color: palette.inverse }]}>
              다시 편집하기
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={[styles.lightButton, { backgroundColor: palette.background, borderColor: palette.text }]} onPress={() => router.back()}>
            <Text selectable={false} style={[styles.lightButtonText, { color: palette.text }]}>
              돌아가기
            </Text>
          </Pressable>
          {message ? (
            <Text selectable style={[styles.message, { color: palette.muted }]}>
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
  const expoVideoModule = getExpoVideoModule();

  if (!expoVideoModule) {
    return (
      <View style={styles.videoUnavailable}>
        <Text selectable style={styles.videoUnavailableText}>
          영상 재생 기능을 불러오지 못했습니다. 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.
        </Text>
        <Pressable accessibilityRole="button"
          style={styles.lightButton}
          onPress={() => router.replace("/video-library" as Href)}
        >
          <Text selectable={false} style={styles.lightButtonText}>
            보관함으로 돌아가기
          </Text>
        </Pressable>
      </View>
    );
  }

  return <NativeVideoPlayerFrame source={source} videoModule={expoVideoModule} />;
}

class VideoPlaybackBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("영상 재생 화면을 열지 못했습니다.", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.videoUnavailable}>
          <Text selectable style={styles.videoUnavailableText}>
            영상 재생 화면을 열지 못했습니다. 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.
          </Text>
          <Pressable accessibilityRole="button"
            style={styles.lightButton}
            onPress={() => router.replace("/video-library" as Href)}
          >
            <Text selectable={false} style={styles.lightButtonText}>
              보관함으로 돌아가기
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

function NativeVideoPlayerFrame({
  source,
  videoModule
}: {
  source: string;
  videoModule: ExpoVideoModule;
}) {
  const { useVideoPlayer, VideoView } = videoModule;
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
  });

  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="contain"
      surfaceType="surfaceView"
      fullscreenOptions={{ enable: false }}
      useExoShutter
    />
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const { palette } = useAppAppearance();
  return (
    <View style={[styles.metaRow, { borderColor: palette.line, backgroundColor: palette.surface }]}>
      <Text selectable style={[styles.metaLabel, { color: palette.muted }]}>
        {label}
      </Text>
      <Text selectable style={[styles.metaValue, { color: palette.text }]}>
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
    gap: bodyFrameDesign.sectionGap,
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingVertical: spacing.screen,
    width: "100%",
    maxWidth: bodyFrameDesign.contentMaxWidth,
    alignSelf: "center"
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
  videoPoster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink
  },
  videoPosterImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.62
  },
  videoStartButton: {
    minWidth: 120,
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.inverse,
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "rgba(0,0,0,0.72)"
  },
  videoStartButtonText: {
    color: colors.inverse,
    fontSize: bodyFrameTypography.button,
    fontWeight: "800"
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
    fontSize: bodyFrameTypography.pageTitle,
    fontWeight: "600",
    lineHeight: 32,
    letterSpacing: 0
  },
  detail: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 20,
    letterSpacing: 0
  },
  metaPanel: {
    gap: 8
  },
  metaRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 14,
    borderWidth: 1
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
    minHeight: bodyFrameDesign.primaryButtonHeight,
    borderRadius: bodyFrameDesign.buttonRadius,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  darkButtonText: {
    color: colors.inverse,
    fontSize: bodyFrameTypography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  lightButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    borderRadius: bodyFrameDesign.buttonRadius,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  lightButtonText: {
    color: colors.text,
    fontSize: bodyFrameTypography.button,
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
