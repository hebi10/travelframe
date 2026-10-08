
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
    <View style={[styles.metaRow, { borderBottomColor: palette.line }]}>
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
    gap: spacing.section,
    padding: spacing.screen,
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
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.inverse,
    backgroundColor: "rgba(0,0,0,0.72)"
  },
  videoStartButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
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
