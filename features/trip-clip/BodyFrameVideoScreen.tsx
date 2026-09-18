import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
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

import { TripClipRecordingCanvas } from "@/components/trip-clip-recording-canvas";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import {
  BODY_FRAME_VIDEO_FPS,
  BODY_FRAME_VIDEO_MAX_OUTPUT_SIZE,
  BODY_FRAME_VIDEO_RATIO,
  BODY_FRAME_VIDEO_TEMPLATE,
  BODY_FRAME_VIDEO_TRANSITION,
  BODY_FRAME_VIDEO_TRANSITION_DURATION,
  createBodyFrameVideoDurations,
  getBodyFrameVideoDuration,
  getBodyFrameVideoPhotos,
  getBodyFrameVideoTotalFrames
} from "@/lib/body-frame-video";
import { selectActiveBodyProject } from "@/lib/body-frame-camera-project";
import {
  getBodyFrameUpgradeLabel,
  getBodyFrameVideoLimitState
} from "@/lib/body-frame-plan-limits";
import {
  getLastActiveProjectId,
  setLastActiveProjectId
} from "@/lib/body-project-preferences";
import { getBodyProjects } from "@/lib/body-project-library";
import {
  DEFAULT_GUIDE_COLOR,
  defaultGridGuideLinePositions,
  defaultGuideShapePoints
} from "@/lib/app-settings";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
import { ensurePhotoPreviews, getPhotos } from "@/lib/photo-library";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { getRecordingFrame } from "@/lib/trip-clip-playback";
import { saveVideoToLibrary } from "@/lib/trip-clip-export";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { saveMadeVideo } from "@/lib/video-library";
import {
  isRecordingViewAvailable,
  OptionalRecordingView,
  useOptionalViewRecorder
} from "@/lib/view-recorder";
import { RECORDING_VIEW_WIDTH } from "@/features/trip-clip/trip-clip-screen.constants";
import type { BodyProject } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

const BODY_FRAME_ASPECT_RATIO = 9 / 16;
const BODY_FRAME_VIDEO_BITRATE = 5_000_000;
const EMPTY_ADJUSTMENTS = {};

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

const toNativeFilePath = (uri: string) => {
  if (uri.startsWith("file:///")) {
    return uri.replace("file://", "");
  }

  if (uri.startsWith("file:/")) {
    return uri.replace("file:", "");
  }

  return uri;
};

const toFileUri = (pathOrUri: string) =>
  pathOrUri.startsWith("file://") ? pathOrUri : `file://${pathOrUri}`;

const formatDuration = (seconds: number) =>
  Number.isInteger(seconds) ? `${seconds.toFixed(0)}초` : `${seconds.toFixed(1)}초`;

export default function BodyFrameVideoScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const recorder = useOptionalViewRecorder();
  const recordingViewAvailable = isRecordingViewAvailable();
  const { isLoggedIn, subscription } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const [activeProject, setActiveProject] = useState<BodyProject | null | undefined>(
    undefined
  );
  const [projectPhotos, setProjectPhotos] = useState<PhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [recordingFrameIndex, setRecordingFrameIndex] = useState(0);

  const durations = useMemo(
    () => createBodyFrameVideoDurations(projectPhotos),
    [projectPhotos]
  );
  const totalDuration = getBodyFrameVideoDuration(projectPhotos.length);
  const totalFrames = getBodyFrameVideoTotalFrames(projectPhotos.length);
  const videoLimitState = useMemo(
    () =>
      getBodyFrameVideoLimitState({
        durationSeconds: totalDuration,
        maxProgressVideoSeconds: planEntitlements.maxProgressVideoSeconds
      }),
    [planEntitlements.maxProgressVideoSeconds, totalDuration]
  );
  const upgradePlanLabel = getBodyFrameUpgradeLabel(planEntitlements.tier);
  const previewPhoto = projectPhotos[0] ?? null;
  const recordingFrame = useMemo(
    () =>
      getRecordingFrame({
        frameIndex: recordingFrameIndex,
        fps: BODY_FRAME_VIDEO_FPS,
        photos: projectPhotos,
        durations,
        transition: BODY_FRAME_VIDEO_TRANSITION,
        transitionDuration: BODY_FRAME_VIDEO_TRANSITION_DURATION
      }),
    [durations, projectPhotos, recordingFrameIndex]
  );

  const loadActiveProject = useCallback(async () => {
    setIsLoading(true);
    try {
      const [projects, lastActiveProjectId, storedPhotos] = await Promise.all([
        getBodyProjects(),
        getLastActiveProjectId(),
        getPhotos().then(ensurePhotoPreviews)
      ]);
      const selectedProject = selectActiveBodyProject(projects, lastActiveProjectId);

      setActiveProject(selectedProject);
      setProjectPhotos(
        selectedProject
          ? getBodyFrameVideoPhotos(storedPhotos, selectedProject.id)
          : []
      );

      if (selectedProject && selectedProject.id !== lastActiveProjectId) {
        await setLastActiveProjectId(selectedProject.id);
      }
    } catch (error) {
      setActiveProject(null);
      setProjectPhotos([]);
      setMessage(
        getUserFacingErrorMessage(error, "프로젝트 사진을 불러오지 못했습니다.")
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadActiveProject();
    }, [loadActiveProject])
  );

  const preloadProjectPhotos = useCallback(async () => {
    const uris = projectPhotos.map((photo) => photo.previewUri ?? photo.uri);
    if (uris.length === 0) {
      return;
    }

    try {
      await Image.prefetch(uris, "memory-disk");
    } catch {
      // Preloading is best-effort. The recorder can still resolve the image URI.
    }
  }, [projectPhotos]);

  const recordProjectVideo = useCallback(async () => {
    if (!recordingViewAvailable) {
      throw new Error(
        "MP4 저장 기능을 사용할 수 없습니다. 앱을 최신 버전으로 업데이트해 주세요."
      );
    }

    if (!FileSystem.cacheDirectory) {
      throw new Error("영상 파일을 만들 임시 저장소를 찾지 못했습니다.");
    }

    if (projectPhotos.length === 0 || totalFrames <= 0) {
      throw new Error("영상으로 만들 프로젝트 사진이 없습니다.");
    }

    await preloadProjectPhotos();
    setRecordingFrameIndex(0);
    await waitForPaint();

    const outputUri = `${FileSystem.cacheDirectory}body-frame-${Date.now()}.mp4`;
    const recordedPath = await recorder.record({
      output: toNativeFilePath(outputUri),
      fps: BODY_FRAME_VIDEO_FPS,
      totalFrames,
      width: BODY_FRAME_VIDEO_MAX_OUTPUT_SIZE.width,
      height: BODY_FRAME_VIDEO_MAX_OUTPUT_SIZE.height,
      codec: "h264",
      quality: 0.92,
      bitrate: BODY_FRAME_VIDEO_BITRATE,
      keyFrameInterval: 1,
      onFrame: async ({ frameIndex }) => {
        setRecordingFrameIndex(frameIndex);
        await waitForPaint();
      },
      onProgress: ({ framesEncoded }) => {
        setExportProgress(
          Math.min(84, Math.max(5, Math.round((framesEncoded / totalFrames) * 84)))
        );
      }
    });

    const recordedUri = toFileUri(recordedPath);
    const fileInfo = await FileSystem.getInfoAsync(recordedUri);
    if (!fileInfo.exists) {
      throw new Error("MP4 파일 생성은 완료됐지만 저장할 파일을 찾지 못했습니다.");
    }

    return recordedUri;
  }, [
    preloadProjectPhotos,
    projectPhotos.length,
    recorder,
    recordingViewAvailable,
    totalFrames
  ]);

  const createVideo = useCallback(async () => {
    if (!activeProject || projectPhotos.length === 0 || isExporting) {
      return;
    }

    if (!planEntitlements.canExportVideo) {
      setMessage("현재 플랜에서는 영상을 만들 수 없습니다.");
      return;
    }

    if (!videoLimitState.allowed) {
      setMessage(
        `${planEntitlements.label} 플랜의 변화 영상 한도는 ${formatDuration(
          videoLimitState.limit ?? 0
        )}입니다. 현재 영상은 ${formatDuration(totalDuration)}입니다.`
      );
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(5);
      setMessage(null);

      const videoUri = await recordProjectVideo();
      setExportProgress(88);
      await saveVideoToLibrary(videoUri);
      setExportProgress(94);

      await saveMadeVideo(
        {
          uri: videoUri,
          coverUri: previewPhoto?.uri,
          projectId: activeProject.id,
          title: `${activeProject.name} 변화 영상`,
          ratio: BODY_FRAME_VIDEO_RATIO,
          template: BODY_FRAME_VIDEO_TEMPLATE,
          transition: BODY_FRAME_VIDEO_TRANSITION,
          transitionDuration: BODY_FRAME_VIDEO_TRANSITION_DURATION,
          duration: totalDuration,
          photoIds: projectPhotos.map((photo) => photo.id),
          durations,
          musicId: "none",
          musicLabel: "무음"
        },
        {
          localVideoLimit: planEntitlements.localVideoLimit
        }
      );

      setExportProgress(100);
      setMessage(
        `${projectPhotos.length}장 · ${formatDuration(totalDuration)} 변화 영상을 저장했습니다.`
      );
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "변화 영상을 만들지 못했습니다."));
    } finally {
      setIsExporting(false);
    }
  }, [
    activeProject,
    durations,
    isExporting,
    planEntitlements.canExportVideo,
    planEntitlements.localVideoLimit,
    planEntitlements.label,
    previewPhoto?.uri,
    projectPhotos,
    recordProjectVideo,
    totalDuration,
    videoLimitState.allowed,
    videoLimitState.limit
  ]);

  if (isLoading || activeProject === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.text} />
        <Text style={[styles.detail, { color: palette.muted }]}>
          프로젝트를 불러오는 중입니다.
        </Text>
      </View>
    );
  }

  if (!activeProject) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.title, { color: palette.text }]}>
          변화 영상을 만들 프로젝트가 없습니다.
        </Text>
        <Text style={[styles.detail, { color: palette.muted }]}>
          촬영 화면에서 프로젝트를 만든 뒤 다시 확인해 주세요.
        </Text>
        {message ? (
          <Text style={[styles.errorText, { color: palette.muted }]}>{message}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 18, 28), paddingBottom: insets.bottom + 32 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: palette.text }]}>변화 영상</Text>
        <Text style={[styles.projectName, { color: palette.muted }]}>
          {activeProject.name}
        </Text>

        <View
          style={[
            styles.previewFrame,
            {
              borderColor: palette.line,
              backgroundColor: palette.surface
            }
          ]}
        >
          {previewPhoto ? (
            <Image
              source={{ uri: previewPhoto.previewUri ?? previewPhoto.uri }}
              style={styles.previewImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.previewEmpty}>
              <Text style={[styles.previewEmptyText, { color: palette.faint }]}>
                아직 기록된 사진이 없습니다.
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.summaryCard,
            {
              borderColor: palette.line,
              backgroundColor: palette.surface
            }
          ]}
        >
          <SummaryRow label="사진" value={`${projectPhotos.length}장`} />
          <SummaryRow label="간격" value="0.1초" />
          <SummaryRow label="영상 길이" value={formatDuration(totalDuration)} />
          <SummaryRow
            label="플랜 한도"
            value={
              planEntitlements.maxProgressVideoSeconds === null
                ? "제한 없음"
                : formatDuration(planEntitlements.maxProgressVideoSeconds)
            }
          />
          <SummaryRow label="프레임" value={`${BODY_FRAME_VIDEO_FPS}fps · ${totalFrames}프레임`} />
          <SummaryRow label="화질" value="1080p" />
          <SummaryRow label="비율" value={BODY_FRAME_VIDEO_RATIO} />
          <SummaryRow label="전환 효과" value="없음" last />
        </View>

        {!videoLimitState.allowed ? (
          <View
            style={[
              styles.limitNotice,
              {
                borderColor: palette.line,
                backgroundColor: palette.surface
              }
            ]}
          >
            <Text style={[styles.limitNoticeText, { color: palette.muted }]}>
              {planEntitlements.label} 플랜에서는 최대{" "}
              {formatDuration(videoLimitState.limit ?? 0)}까지 만들 수 있습니다.
              현재 프로젝트는 {formatDuration(totalDuration)}입니다.
            </Text>
            {upgradePlanLabel ? (
              <Pressable
                accessibilityRole="button"
                style={[styles.limitPlanButton, { borderColor: palette.text }]}
                onPress={() => router.push("/account")}
              >
                <Text style={[styles.limitPlanButtonText, { color: palette.text }]}>
                  플랜 보기 · {upgradePlanLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={
            projectPhotos.length === 0 ||
            isExporting ||
            !videoLimitState.allowed
          }
          onPress={() => void createVideo()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: palette.text },
            (projectPhotos.length === 0 ||
              isExporting ||
              !videoLimitState.allowed) &&
              styles.disabled,
            pressed &&
              projectPhotos.length > 0 &&
              !isExporting &&
              videoLimitState.allowed &&
              styles.pressed
          ]}
        >
          {isExporting ? (
            <View style={styles.buttonLoadingRow}>
              <ActivityIndicator size="small" color={palette.inverse} />
              <Text style={[styles.primaryButtonText, { color: palette.inverse }]}>
                영상 만드는 중 {exportProgress}%
              </Text>
            </View>
          ) : (
            <Text style={[styles.primaryButtonText, { color: palette.inverse }]}>
              영상 만들기
            </Text>
          )}
        </Pressable>

        {message ? (
          <Text style={[styles.message, { color: palette.muted }]}>{message}</Text>
        ) : null}
      </ScrollView>

      {recordingViewAvailable ? (
        <View pointerEvents="none" style={styles.recordingHost}>
          <OptionalRecordingView
            available={recordingViewAvailable}
            sessionId={recorder.sessionId}
            style={styles.recordingView}
          >
            <TripClipRecordingCanvas
              frame={recordingFrame}
              template={BODY_FRAME_VIDEO_TEMPLATE}
              transition={BODY_FRAME_VIDEO_TRANSITION}
              showWatermark={planEntitlements.showWatermark}
              frameAspectRatio={BODY_FRAME_ASPECT_RATIO}
              guideVisible={false}
              guide="circle"
              guideSize={44}
              guideStrokeWidth={1}
              guideColor={DEFAULT_GUIDE_COLOR}
              guideLineOpacity={1}
              guideOffsetX={0}
              guideOffsetY={0}
              guideOffsetFrameWidth={0}
              guideOffsetFrameHeight={0}
              gridGuideLinePositions={defaultGridGuideLinePositions}
              guideShapePoints={defaultGuideShapePoints}
              photoAdjustments={EMPTY_ADJUSTMENTS}
            />
          </OptionalRecordingView>
        </View>
      ) : null}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  last = false
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { palette } = useAppAppearance();
  void last;

  return (
    <View
      style={styles.summaryRow}
    >
      <Text style={[styles.summaryLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: bodyFrameDesign.horizontalPadding
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  pageTitle: {
    fontSize: bodyFrameTypography.pageTitle,
    fontWeight: "600"
  },
  projectName: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center"
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    textAlign: "center"
  },
  previewFrame: {
    alignSelf: "center",
    width: "58%",
    maxWidth: 280,
    aspectRatio: BODY_FRAME_ASPECT_RATIO,
    overflow: "hidden",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius,
    backgroundColor: "#131315"
  },
  previewImage: {
    width: "100%",
    height: "100%"
  },
  previewEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  previewEmptyText: {
    fontSize: 13,
    textAlign: "center"
  },
  summaryCard: {
    marginTop: 24,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius,
    paddingHorizontal: 14
  },
  summaryRow: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  summaryLabel: {
    fontSize: 14
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500"
  },
  limitNotice: {
    marginTop: 16,
    padding: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius,
    backgroundColor: "#131315"
  },
  limitNoticeText: {
    fontSize: 13,
    lineHeight: 19
  },
  limitPlanButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  limitPlanButtonText: {
    fontSize: 13,
    fontWeight: "600"
  },
  primaryButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 16
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700"
  },
  buttonLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.82
  },
  message: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  recordingHost: {
    position: "absolute",
    top: 0,
    left: -10000,
    width: RECORDING_VIEW_WIDTH,
    height: RECORDING_VIEW_WIDTH / BODY_FRAME_ASPECT_RATIO
  },
  recordingView: {
    width: RECORDING_VIEW_WIDTH,
    aspectRatio: BODY_FRAME_ASPECT_RATIO,
    backgroundColor: "#000000"
  }
});
