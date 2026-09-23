import { Image } from "@/components/private-media-image";
import * as FileSystem from "expo-file-system/legacy";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { BodyFrameVideoOptionsSheet, type VideoOptionKind } from "@/features/trip-clip/BodyFrameVideoOptionsSheet";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import {
  BODY_FRAME_VIDEO_FPS,
  DEFAULT_BODY_FRAME_VIDEO_OPTIONS,
  getBodyFrameVideoOutputSize,
  getBodyFrameVideoOverlaySummary,
  getBodyFrameVideoOverlayText,
  getBodyFrameVideoPhotoIndex,
  selectBodyFrameVideoPhotos,
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
import { getBodyMeasurements } from "@/lib/body-measurement-library";
import {
  DEFAULT_GUIDE_COLOR,
  defaultGridGuideLinePositions,
  defaultGuideShapePoints
} from "@/lib/app-settings";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
import { ensurePhotoPreviews, getPhotos } from "@/lib/photo-library";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import {
  getGuestWeeklyVideoExportUsage,
  recordGuestWeeklyVideoExport,
  type WeeklyVideoExportUsage
} from "@/lib/video-export-quota";
import { saveVideoToLibrary } from "@/lib/trip-clip-export";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { getMadeVideos, saveMadeVideo } from "@/lib/video-library";
import { assertLocalLibraryCapacity } from "@/lib/local-library-limit";
import {
  isRecordingViewAvailable,
  OptionalRecordingView,
  useOptionalViewRecorder
} from "@/lib/view-recorder";
import { RECORDING_VIEW_WIDTH } from "@/features/trip-clip/trip-clip-screen.constants";
import type { BodyProject } from "@/types/body-project";
import type { BodyMeasurementEntry } from "@/types/body-measurement";
import type { PhotoItem } from "@/types/photo";

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
  const [availablePhotos, setAvailablePhotos] = useState<PhotoItem[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [videoOptions, setVideoOptions] = useState(DEFAULT_BODY_FRAME_VIDEO_OPTIONS);
  const [optionKind, setOptionKind] = useState<VideoOptionKind | null>(null);
  const loadedProjectId = useRef<string | null>(null);
  const projectPhotos = useMemo(
    () => selectBodyFrameVideoPhotos(availablePhotos, selectedIds),
    [availablePhotos, selectedIds]
  );
  const recordingPhotos = useMemo(
    () => projectPhotos.map(photo => ({ ...photo, previewUri: photo.uri })),
    [projectPhotos]
  );
  const measurementByPhotoId = useMemo(() => {
    const map = new Map<string, BodyMeasurementEntry>();
    measurements.forEach((entry) => {
      if (entry.photoId) {
        map.set(entry.photoId, entry);
      }
    });
    return map;
  }, [measurements]);
  const measurementBySequence = useMemo(() => {
    const map = new Map<number, BodyMeasurementEntry>();
    measurements.forEach((entry) => {
      if (typeof entry.sequence === "number") {
        map.set(entry.sequence, entry);
      }
    });
    return map;
  }, [measurements]);
  const getMeasurementForPhoto = useCallback(
    (photo?: PhotoItem | null) => {
      if (!photo) return null;
      return (
        measurementByPhotoId.get(photo.id) ??
        (typeof photo.sequence === "number"
          ? measurementBySequence.get(photo.sequence) ?? null
          : null)
      );
    },
    [measurementByPhotoId, measurementBySequence]
  );
  const outputSize = getBodyFrameVideoOutputSize(videoOptions.ratio, videoOptions.quality);
  const frameAspectRatio = outputSize.width / outputSize.height;
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [recordingFrameIndex, setRecordingFrameIndex] = useState(0);
  const [guestUsage, setGuestUsage] = useState<WeeklyVideoExportUsage | null>(null);

  const durations = useMemo(
    () => createBodyFrameVideoDurations(projectPhotos, videoOptions.interval),
    [projectPhotos, videoOptions.interval]
  );
  const totalDuration = getBodyFrameVideoDuration(projectPhotos.length, videoOptions.interval);
  const totalFrames = getBodyFrameVideoTotalFrames(projectPhotos.length, videoOptions.interval);
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
    () => ({
      currentPhoto: recordingPhotos[getBodyFrameVideoPhotoIndex(recordingFrameIndex, videoOptions.interval)] ?? null,
      nextPhoto: null,
      transitionProgress: 0
    }),
    [recordingPhotos, recordingFrameIndex, videoOptions.interval]
  );
  const recordingOverlayText = useMemo(
    () =>
      getBodyFrameVideoOverlayText({
        photo: recordingFrame.currentPhoto,
        measurement: getMeasurementForPhoto(recordingFrame.currentPhoto),
        overlay: videoOptions.overlay
      }),
    [getMeasurementForPhoto, recordingFrame.currentPhoto, videoOptions.overlay]
  );
  const previewOverlayText = useMemo(
    () =>
      getBodyFrameVideoOverlayText({
        photo: previewPhoto,
        measurement: getMeasurementForPhoto(previewPhoto),
        overlay: videoOptions.overlay
      }),
    [getMeasurementForPhoto, previewPhoto, videoOptions.overlay]
  );
  const previewOverlayPositionStyle =
    videoOptions.overlay.position === "top-left"
      ? styles.previewOverlayTopLeft
      : videoOptions.overlay.position === "top-right"
        ? styles.previewOverlayTopRight
        : videoOptions.overlay.position === "bottom-left"
          ? styles.previewOverlayBottomLeft
          : styles.previewOverlayBottomRight;

  const loadActiveProject = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        projects,
        lastActiveProjectId,
        storedPhotos,
        storedMeasurements,
        nextGuestUsage
      ] = await Promise.all([
        getBodyProjects(),
        getLastActiveProjectId(),
        getPhotos().then(ensurePhotoPreviews),
        getBodyMeasurements(),
        isLoggedIn
          ? Promise.resolve(null)
          : getGuestWeeklyVideoExportUsage(planEntitlements.weeklyVideoExportLimit)
      ]);
      const selectedProject = selectActiveBodyProject(projects, lastActiveProjectId);

      setActiveProject(selectedProject);
      if (loadedProjectId.current !== (selectedProject?.id ?? null)) {
        setSelectedIds(null);
        setOptionKind(null);
        loadedProjectId.current = selectedProject?.id ?? null;
      }
      setAvailablePhotos(
        selectedProject
          ? getBodyFrameVideoPhotos(storedPhotos, selectedProject.id)
          : []
      );
      setMeasurements(
        selectedProject
          ? storedMeasurements.filter(
              (entry) => entry.projectId === selectedProject.id
            )
          : []
      );
      setGuestUsage(nextGuestUsage);

      if (selectedProject && selectedProject.id !== lastActiveProjectId) {
        await setLastActiveProjectId(selectedProject.id);
      }
    } catch (error) {
      setActiveProject(null);
      setAvailablePhotos([]);
      setMeasurements([]);
      setMessage(
        getUserFacingErrorMessage(error, "프로젝트 사진을 불러오지 못했습니다.")
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn, planEntitlements.weeklyVideoExportLimit]);

  useFocusEffect(
    useCallback(() => {
      void loadActiveProject();
    }, [loadActiveProject])
  );

  const preloadProjectPhotos = useCallback(async () => {
    const uris = recordingPhotos.map((photo) => photo.uri);
    if (uris.length === 0) {
      return;
    }

    try {
      await Image.prefetch(uris, "memory-disk");
    } catch {
      // Preloading is best-effort. The recorder can still resolve the image URI.
    }
  }, [recordingPhotos]);

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
      width: outputSize.width,
      height: outputSize.height,
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
    outputSize.width,
    outputSize.height,
    totalFrames
  ]);

  const createVideo = useCallback(async () => {
    if (!activeProject || projectPhotos.length === 0 || isExporting) {
      return;
    }

    if (!planEntitlements.canExportVideo) {
      setMessage("현재 상태에서는 영상을 만들 수 없습니다.");
      return;
    }

    if (!isLoggedIn && guestUsage && guestUsage.remaining <= 0) {
      setMessage(
        `비로그인 상태에서는 주 1회만 영상을 만들 수 있습니다. 다음 주에 다시 만들거나 로그인해 주세요.`
      );
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

      const storedVideos = await getMadeVideos();
      assertLocalLibraryCapacity({
        currentCount: storedVideos.length,
        limit: planEntitlements.localVideoLimit,
        label: "영상"
      });
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
          ratio: videoOptions.ratio,
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

      if (!isLoggedIn) {
        const nextUsage = await recordGuestWeeklyVideoExport(
          planEntitlements.weeklyVideoExportLimit
        );
        setGuestUsage(nextUsage);
      }

      setExportProgress(100);
      setMessage(
        `${projectPhotos.length}장 · ${formatDuration(totalDuration)} 변화 영상을 Body Frame 앨범에 저장했습니다.`
      );
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "변화 영상을 만들지 못했습니다."));
    } finally {
      setIsExporting(false);
    }
  }, [
    activeProject,
    durations,
    guestUsage,
    isExporting,
    isLoggedIn,
    planEntitlements.canExportVideo,
    planEntitlements.localVideoLimit,
    planEntitlements.label,
    previewPhoto?.uri,
    projectPhotos,
    recordProjectVideo,
    totalDuration,
    videoOptions.ratio,
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
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="영상 화면으로 돌아가기"
            disabled={isExporting}
            onPress={() => router.back()}
            style={[styles.backButton, { borderColor: palette.line }]}
          >
            <Text style={[styles.backButtonText, { color: palette.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.pageTitle, { color: palette.text }]}>변화 영상 만들기</Text>
          <Pressable
            accessibilityRole="button"
            disabled={isExporting}
            onPress={() => router.push("/video-library")}
            style={styles.manageButton}
          >
            <Text style={[styles.manageButtonText, { color: palette.text }]}>
              관리
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.projectName, { color: palette.muted }]}>
          {activeProject.name}
        </Text>
        {!isLoggedIn ? (
          <Text style={[styles.guestLimitText, { color: palette.muted }]}>
            비로그인 영상 출력 · 이번 주 {guestUsage?.count ?? 0}/1회
          </Text>
        ) : null}

        <View
          style={[
            styles.previewFrame,
            {
              borderColor: palette.line,
              backgroundColor: palette.surface,
              aspectRatio: frameAspectRatio
            }
          ]}
        >
          {previewPhoto ? (
            <>
              <Image
                source={{ uri: previewPhoto.previewUri ?? previewPhoto.uri }}
                style={styles.previewImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              {previewOverlayText ? (
                <Text
                  numberOfLines={2}
                  style={[
                    styles.previewOverlayText,
                    previewOverlayPositionStyle
                  ]}
                >
                  {previewOverlayText}
                </Text>
              ) : null}
            </>
          ) : (
            <View style={styles.previewEmpty}>
              <Text style={[styles.previewEmptyText, { color: palette.faint }]}>
                영상에 사용할 사진을 선택해 주세요.
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
          <SummaryRow label="사진 수" value={`${projectPhotos.length} / ${availablePhotos.length}장`} disabled={isExporting} onPress={() => setOptionKind("photos")} />
          <SummaryRow label="사진 간격" value={`${videoOptions.interval}초`} disabled={isExporting} onPress={() => setOptionKind("interval")} />
          <SummaryRow label="영상 길이" value={formatDuration(totalDuration)} />
          <SummaryRow label="화질" value={`${videoOptions.quality}p`} disabled={isExporting} onPress={() => setOptionKind("quality")} />
          <SummaryRow label="화면 비율" value={videoOptions.ratio} disabled={isExporting} onPress={() => setOptionKind("ratio")} />
          <SummaryRow
            label="텍스트"
            value={getBodyFrameVideoOverlaySummary(videoOptions.overlay)}
            disabled={isExporting}
            onPress={() => setOptionKind("overlay")}
          />
        </View>

        <Text style={[styles.orderHint, { color: palette.muted }]}>
          영상은 프로젝트의 사진 순서(#1 → #2 → #3 …)대로 만들어집니다. 순서를 바꾸려면 프로젝트 상세의 순서 조정에서 변경해 주세요.
        </Text>

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
            !videoLimitState.allowed ||
            (!isLoggedIn && Boolean(guestUsage && guestUsage.remaining <= 0))
          }
          onPress={() => void createVideo()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: palette.text },
            (projectPhotos.length === 0 ||
              isExporting ||
              !videoLimitState.allowed ||
              (!isLoggedIn && Boolean(guestUsage && guestUsage.remaining <= 0))) &&
              styles.disabled,
            pressed &&
              projectPhotos.length > 0 &&
              !isExporting &&
              videoLimitState.allowed &&
              (isLoggedIn || !guestUsage || guestUsage.remaining > 0) &&
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

      {optionKind ? (
        <BodyFrameVideoOptionsSheet
          kind={optionKind}
          options={videoOptions}
          photos={availablePhotos}
          selectedIds={selectedIds}
          onCancel={() => setOptionKind(null)}
          onApply={(options, ids) => {
            setVideoOptions(options);
            setSelectedIds(ids);
            setRecordingFrameIndex(0);
            setMessage(null);
            setOptionKind(null);
          }}
        />
      ) : null}

      {recordingViewAvailable ? (
        <View pointerEvents="none" style={[styles.recordingHost, { height: RECORDING_VIEW_WIDTH / frameAspectRatio }]}>
          <OptionalRecordingView
            available={recordingViewAvailable}
            sessionId={recorder.sessionId}
            style={[styles.recordingView, { aspectRatio: frameAspectRatio }]}
          >
            <TripClipRecordingCanvas
              frame={recordingFrame}
              template={BODY_FRAME_VIDEO_TEMPLATE}
              transition={BODY_FRAME_VIDEO_TRANSITION}
              showWatermark={planEntitlements.showWatermark}
              frameAspectRatio={frameAspectRatio}
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
              bodyFrameOverlayText={recordingOverlayText}
              bodyFrameOverlayPosition={videoOptions.overlay.position}
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
  onPress,
  disabled = false
}: {
  label: string;
  value: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { palette } = useAppAppearance();

  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} disabled={disabled || !onPress} onPress={onPress} style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}{onPress ? "  ›" : ""}</Text>
    </Pressable>
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
  topBar: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  backButton: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  backButtonText: {
    fontSize: 30,
    lineHeight: 30,
    fontWeight: "500"
  },
  pageTitle: {
    flex: 1,
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600",
    textAlign: "center"
  },
  manageButton: {
    minWidth: bodyFrameDesign.minTouchSize,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  manageButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  projectName: {
    marginTop: 14,
    marginBottom: 4,
    fontSize: 14
  },
  guestLimitText: {
    marginBottom: 16,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
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
    overflow: "hidden",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius,
    backgroundColor: "#131315"
  },
  previewImage: {
    width: "100%",
    height: "100%"
  },
  previewOverlayText: {
    position: "absolute",
    zIndex: 4,
    maxWidth: "72%",
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.72)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  previewOverlayTopLeft: {
    top: 10,
    left: 10,
    textAlign: "left"
  },
  previewOverlayTopRight: {
    top: 10,
    right: 10,
    textAlign: "right"
  },
  previewOverlayBottomLeft: {
    bottom: 10,
    left: 10,
    textAlign: "left"
  },
  previewOverlayBottomRight: {
    right: 10,
    bottom: 10,
    textAlign: "right"
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
  orderHint: {
    marginTop: 10,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
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
    borderRadius: bodyFrameDesign.buttonRadius,
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
    width: RECORDING_VIEW_WIDTH
  },
  recordingView: {
    width: RECORDING_VIEW_WIDTH,
    backgroundColor: "#000000"
  }
});
