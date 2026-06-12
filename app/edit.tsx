import * as ImagePicker from "expo-image-picker";
import { router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useDerivedValue,
  useSharedValue
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EditablePhotoCanvas,
  type EditablePhotoCanvasHandle
} from "@/components/editable-photo-canvas";
import { colors, controls, typography } from "@/constants/app-theme";
import { GUIDE_LABELS, GUIDE_TYPES, type GuideType } from "@/constants/camera-guides";
import {
  clearEditDraft,
  getEditDraft,
  isSameEditDraftSource,
  saveEditDraft,
  type PhotoEditDraft
} from "@/lib/photo-edit-draft";
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_SIZE_MAX,
  GUIDE_SIZE_MIN,
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
  defaultAppSettings,
  getAppSettings,
  updateAppSettings,
  type GridGuideLinePositions,
  type GuideShapePoints
} from "@/lib/app-settings";
import {
  calculateGuidePositionDragOffset,
  clampGuidePositionOffset,
  type CameraGuideFrame
} from "@/lib/camera-guide-position";
import { useAuth } from "@/lib/auth-context";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { isMediaLibraryAccessGranted } from "@/lib/media-library-permissions";
import { requestMediaLibraryAccess } from "@/lib/request-media-library-access";
import { recordBackupFailure } from "@/lib/backup-failure-queue";
import { backupPhotoIfEnabled } from "@/lib/cloud-backup";
import { getPhotoById, saveEditedPhoto } from "@/lib/photo-library";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import type { PhotoEditTransform, PhotoItem, PhotoRatioLabel } from "@/types/photo";

type EditableSource = {
  uri: string;
  width?: number;
  height?: number;
  sourcePhotoId?: string;
};

type SaveEditMode = "new" | "overwrite";
type EditPanelTab = "image" | "guide";

const ratios: PhotoRatioLabel[] = ["Original", "1:1", "3:4", "4:3", "4:5", "9:16", "16:9"];
const EDIT_PANEL_TABS: { label: string; value: EditPanelTab }[] = [
  { label: "이미지 편집", value: "image" },
  { label: "가이드라인 편집", value: "guide" }
];
const GUIDE_SIZE_OPTIONS = [
  { label: "작게", value: 34 },
  { label: "기본", value: 44 },
  { label: "크게", value: 56 }
] as const;
const GUIDE_STROKE_WIDTH_OPTIONS = [1, 2, 3, 4, 5] as const;
const GUIDE_COLOR_OPTIONS = [
  { label: "흰색", value: DEFAULT_GUIDE_COLOR },
  { label: "노랑", value: "#F5D76E" },
  { label: "민트", value: "#8CECC1" },
  { label: "파랑", value: "#A9D7FF" },
  { label: "빨강", value: "#FF5A5F" },
  { label: "검정", value: "rgba(17, 17, 17, 0.78)" }
] as const;

const clampEditGuideSize = (value: number) => {
  "worklet";

  return Math.round(Math.max(GUIDE_SIZE_MIN, Math.min(GUIDE_SIZE_MAX, value)));
};

const getGuideSizeFromTrackX = (trackX: number, trackWidth: number) => {
  "worklet";

  if (!Number.isFinite(trackX) || trackWidth <= 0) {
    return GUIDE_SIZE_MIN;
  }

  const ratio = Math.max(0, Math.min(1, trackX / trackWidth));
  return clampEditGuideSize(GUIDE_SIZE_MIN + ratio * (GUIDE_SIZE_MAX - GUIDE_SIZE_MIN));
};

const ratioDisplayLabel = (value: PhotoRatioLabel) =>
  value === "Original" ? "원본" : value;

const getFallbackTransform = (ratio: PhotoRatioLabel): PhotoEditTransform => ({
  ratioLabel: ratio,
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotation: 0
});

const formatDraftTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const getDraftSourceKey = (draft: Pick<PhotoEditDraft, "sourceUri" | "sourcePhotoId">) =>
  draft.sourcePhotoId ?? draft.sourceUri;

export default function EditScreen() {
  const { user, subscription, isAuthLoading } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn: Boolean(user), subscription }),
    [subscription, user]
  );
  const { photoId } = useLocalSearchParams<{ photoId?: string }>();
  const canvasRef = useRef<EditablePhotoCanvasHandle>(null);
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + 14, 28);
  const [source, setSource] = useState<EditableSource | null>(null);
  const [sourcePhoto, setSourcePhoto] = useState<PhotoItem | null>(null);
  const [ratio, setRatio] = useState<PhotoRatioLabel>("Original");
  const [isLoading, setIsLoading] = useState(Boolean(photoId));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [availableDraft, setAvailableDraft] = useState<PhotoEditDraft | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [dismissedDraftSourceKey, setDismissedDraftSourceKey] = useState<string | null>(null);
  const [pendingTransform, setPendingTransform] = useState<PhotoEditTransform | null>(null);
  const [transformApplyKey, setTransformApplyKey] = useState(0);
  const [guide, setGuide] = useState<GuideType>(defaultAppSettings.defaultGuide);
  const [guideVisible, setGuideVisible] = useState(defaultAppSettings.guideVisible);
  const [guideSize, setGuideSize] = useState(defaultAppSettings.guideSize);
  const [guideStrokeWidth, setGuideStrokeWidth] = useState(
    defaultAppSettings.guideStrokeWidth
  );
  const [guideColor, setGuideColor] = useState(defaultAppSettings.guideColor);
  const [guideLineOpacity, setGuideLineOpacity] = useState(defaultAppSettings.guideLineOpacity);
  const [guideOffsetX, setGuideOffsetX] = useState(defaultAppSettings.guideOffsetX);
  const [guideOffsetY, setGuideOffsetY] = useState(defaultAppSettings.guideOffsetY);
  const [guideOffsetFrameWidth, setGuideOffsetFrameWidth] = useState(
    defaultAppSettings.guideOffsetFrameWidth
  );
  const [guideOffsetFrameHeight, setGuideOffsetFrameHeight] = useState(
    defaultAppSettings.guideOffsetFrameHeight
  );
  const [gridGuideLinePositions, setGridGuideLinePositions] =
    useState<GridGuideLinePositions>(defaultAppSettings.gridGuideLinePositions);
  const [guideShapePoints, setGuideShapePoints] =
    useState<GuideShapePoints>(defaultAppSettings.guideShapePoints);
  const [guidePanelOpen, setGuidePanelOpen] = useState(false);
  const [activeEditPanelTab, setActiveEditPanelTab] = useState<EditPanelTab>("image");
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const [isGuidePositionAdjusting, setIsGuidePositionAdjusting] = useState(false);
  const [guideMoveFrame, setGuideMoveFrame] = useState<CameraGuideFrame>({
    width: 0,
    height: 0
  });
  const guideOffsetXValue = useSharedValue(defaultAppSettings.guideOffsetX);
  const guideOffsetYValue = useSharedValue(defaultAppSettings.guideOffsetY);
  const guideDragStartX = useSharedValue(0);
  const guideDragStartY = useSharedValue(0);
  const loginRequiredAlertShownRef = useRef(false);
  const originalAspectRatio =
    source?.width && source?.height ? source.width / source.height : undefined;
  const canOverwriteSource = Boolean(sourcePhoto?.edited);

  useEffect(() => {
    if (isAuthLoading || user || loginRequiredAlertShownRef.current) {
      return;
    }

    if (!user) {
      loginRequiredAlertShownRef.current = true;
      Alert.alert(
        "로그인이 필요합니다",
        "사진 편집은 무료 로그인부터 사용할 수 있습니다.",
        [{ text: "확인", onPress: () => router.replace("/account" as Href) }]
      );
      router.replace("/account" as Href);
    }
  }, [isAuthLoading, user]);

  useEffect(() => {
    let isMounted = true;

    const loadPhoto = async () => {
      if (!photoId) {
        setIsLoading(false);
        return;
      }

      const photo = await getPhotoById(photoId);
      if (isMounted && photo) {
        setSourcePhoto(photo);
        setSource({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          sourcePhotoId: photo.id
        });
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    loadPhoto();

    return () => {
      isMounted = false;
    };
  }, [photoId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadGuideSettings = async () => {
        const settings = await getAppSettings();
        if (!isActive) {
          return;
        }

        setGuide(settings.defaultGuide);
        setGuideVisible(settings.guideVisible);
        setGuideSize(settings.guideSize);
        setGuideStrokeWidth(settings.guideStrokeWidth);
        setGuideColor(settings.guideColor);
        setGuideLineOpacity(settings.guideLineOpacity);
        setGuideOffsetX(settings.guideOffsetX);
        setGuideOffsetY(settings.guideOffsetY);
        setGuideOffsetFrameWidth(settings.guideOffsetFrameWidth);
        setGuideOffsetFrameHeight(settings.guideOffsetFrameHeight);
        setGridGuideLinePositions(settings.gridGuideLinePositions);
        setGuideShapePoints(settings.guideShapePoints);
        guideOffsetXValue.value = settings.guideOffsetX;
        guideOffsetYValue.value = settings.guideOffsetY;
      };

      loadGuideSettings();

      return () => {
        isActive = false;
      };
    }, [guideOffsetXValue, guideOffsetYValue])
  );

  useEffect(() => {
    let isMounted = true;

    const loadDraft = async () => {
      const draft = await getEditDraft();
      if (!isMounted) {
        return;
      }

      if (!draft) {
        setAvailableDraft(null);
        setShowDraftPrompt(false);
        return;
      }

      if (!source || isSameEditDraftSource(draft, source)) {
        setAvailableDraft(draft);
        setShowDraftPrompt(getDraftSourceKey(draft) !== dismissedDraftSourceKey);
      } else {
        setAvailableDraft(null);
        setShowDraftPrompt(false);
      }
    };

    loadDraft();

    return () => {
      isMounted = false;
    };
  }, [dismissedDraftSourceKey, source]);

  const persistDraft = useCallback(async (updateState = true) => {
    if (!source || isSaving) {
      return;
    }

    const draft = await saveEditDraft({
      sourceUri: source.uri,
      sourcePhotoId: source.sourcePhotoId,
      width: source.width,
      height: source.height,
      transform: canvasRef.current?.getTransform() ?? getFallbackTransform(ratio)
    });

    if (updateState) {
      setAvailableDraft(draft);
    }
  }, [isSaving, ratio, source]);

  useEffect(() => {
    if (!source) {
      return;
    }

    const interval = setInterval(() => {
      void persistDraft();
    }, 2500);

    return () => {
      clearInterval(interval);
      void persistDraft(false);
    };
  }, [persistDraft, source]);

  const pickPhoto = async () => {
    setMessage(null);
    const mediaAccessState = await requestMediaLibraryAccess({
      fallbackMessage: "사진을 불러오려면 앨범 접근 권한이 필요합니다.",
      onMessage: setMessage
    });
    if (!isMediaLibraryAccessGranted(mediaAccessState)) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      setSourcePhoto(null);
      setSource({
        uri: asset.uri,
        width: asset.width,
        height: asset.height
      });
      setRatio("Original");
      setPendingTransform(null);
      setAvailableDraft(null);
      setShowDraftPrompt(false);
      setDismissedDraftSourceKey(null);
      setMessage(null);
    }
  };

  const resumeDraft = async () => {
    if (!availableDraft) {
      return;
    }

    try {
      setMessage(null);
      if (availableDraft.sourcePhotoId) {
        const draftPhoto = await getPhotoById(availableDraft.sourcePhotoId);
        setSourcePhoto(draftPhoto);
      } else {
        setSourcePhoto(null);
      }

      setSource({
        uri: availableDraft.sourceUri,
        width: availableDraft.width,
        height: availableDraft.height,
        sourcePhotoId: availableDraft.sourcePhotoId
      });
      setRatio(availableDraft.transform.ratioLabel);
      setPendingTransform(availableDraft.transform);
      setTransformApplyKey((current) => current + 1);
      setDismissedDraftSourceKey(getDraftSourceKey(availableDraft));
      setShowDraftPrompt(false);
      setMessage("임시 저장된 편집 상태를 불러왔습니다.");
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "임시 저장을 불러오지 못했습니다."));
    }
  };

  const removeDraft = async () => {
    try {
      await clearEditDraft();
      setAvailableDraft(null);
      setShowDraftPrompt(false);
      setDismissedDraftSourceKey(null);
      setPendingTransform(null);
      setMessage("임시 저장을 삭제했습니다.");
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "임시 저장을 삭제하지 못했습니다."));
    }
  };

  const updateGuideType = (nextGuide: GuideType) => {
    setGuide(nextGuide);
    setGuideVisible(true);
    void updateAppSettings({
      defaultGuide: nextGuide,
      guideVisible: true
    });
  };

  const updateGuideVisibility = (nextVisible: boolean) => {
    setGuideVisible(nextVisible);
    void updateAppSettings({ guideVisible: nextVisible });
  };

  const updateGuideSize = (nextSize: number) => {
    const clampedSize = clampEditGuideSize(nextSize);
    setGuideSize(clampedSize);
    setGuideVisible(true);
    void updateAppSettings({
      guideSize: clampedSize,
      guideVisible: true
    });
  };

  const previewGuideSize = (nextSize: number) => {
    setGuideSize(clampEditGuideSize(nextSize));
    setGuideVisible(true);
  };

  const commitGuideSize = (nextSize: number) => {
    updateGuideSize(nextSize);
  };

  const updateGuideStrokeWidth = (nextStrokeWidth: number) => {
    const clampedStrokeWidth = Math.round(
      Math.max(
        GUIDE_STROKE_WIDTH_MIN,
        Math.min(GUIDE_STROKE_WIDTH_MAX, nextStrokeWidth)
      )
    );
    setGuideStrokeWidth(clampedStrokeWidth);
    setGuideVisible(true);
    void updateAppSettings({
      guideStrokeWidth: clampedStrokeWidth,
      guideVisible: true
    });
  };

  const updateGuideColor = (nextColor: string) => {
    setGuideColor(nextColor);
    setGuideVisible(true);
    void updateAppSettings({
      guideColor: nextColor,
      guideVisible: true
    });
  };

  const getClampedGuideOffset = useCallback(
    (nextX: number, nextY: number) =>
      clampGuidePositionOffset({ x: nextX, y: nextY }, guideMoveFrame),
    [guideMoveFrame]
  );

  const syncGuideOffsetFromGesture = useCallback(
    (nextX: number, nextY: number) => {
      const clampedOffset = getClampedGuideOffset(nextX, nextY);
      setGuideOffsetX(clampedOffset.x);
      setGuideOffsetY(clampedOffset.y);
    },
    [getClampedGuideOffset]
  );

  const finishGuidePositionAdjustment = useCallback(
    (nextX: number, nextY: number) => {
      const clampedOffset = getClampedGuideOffset(nextX, nextY);
      guideOffsetXValue.value = clampedOffset.x;
      guideOffsetYValue.value = clampedOffset.y;
      setGuideOffsetX(clampedOffset.x);
      setGuideOffsetY(clampedOffset.y);
      setGuideOffsetFrameWidth(guideMoveFrame.width);
      setGuideOffsetFrameHeight(guideMoveFrame.height);
      setGuideVisible(true);
      setIsGuidePositionAdjusting(false);
      setActiveEditPanelTab("guide");
      setGuidePanelOpen(true);
      void updateAppSettings({
        guideOffsetX: clampedOffset.x,
        guideOffsetY: clampedOffset.y,
        guideOffsetFrameWidth: guideMoveFrame.width,
        guideOffsetFrameHeight: guideMoveFrame.height,
        guideVisible: true
      });
    },
    [
      getClampedGuideOffset,
      guideMoveFrame.height,
      guideMoveFrame.width,
      guideOffsetXValue,
      guideOffsetYValue
    ]
  );

  const startGuidePositionAdjustment = () => {
    setGuideVisible(true);
    setGuidePanelOpen(false);
    guideOffsetXValue.value = guideOffsetX;
    guideOffsetYValue.value = guideOffsetY;
    setIsGuidePositionAdjusting(true);
    void updateAppSettings({ guideVisible: true });
  };

  const stopGuidePositionAdjustment = () => {
    finishGuidePositionAdjustment(guideOffsetXValue.value, guideOffsetYValue.value);
  };

  const guidePositionGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isGuidePositionAdjusting)
        .onBegin(() => {
          guideDragStartX.value = guideOffsetXValue.value;
          guideDragStartY.value = guideOffsetYValue.value;
        })
        .onUpdate((event) => {
          const nextOffset = calculateGuidePositionDragOffset({
            startX: guideDragStartX.value,
            startY: guideDragStartY.value,
            translationX: event.translationX,
            translationY: event.translationY,
            frame: guideMoveFrame
          });
          guideOffsetXValue.value = nextOffset.x;
          guideOffsetYValue.value = nextOffset.y;
          runOnJS(syncGuideOffsetFromGesture)(nextOffset.x, nextOffset.y);
        })
        .onFinalize(() => {
          runOnJS(finishGuidePositionAdjustment)(
            guideOffsetXValue.value,
            guideOffsetYValue.value
          );
        }),
    [
      finishGuidePositionAdjustment,
      guideDragStartX,
      guideDragStartY,
      guideMoveFrame,
      guideOffsetXValue,
      guideOffsetYValue,
      isGuidePositionAdjusting,
      syncGuideOffsetFromGesture
    ]
  );

  const executeSaveEdit = async (mode: SaveEditMode) => {
    if (!source || isSaving) {
      setMessage("저장하기 전에 사진을 먼저 불러와 주세요.");
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      const transform =
        canvasRef.current?.getTransform() ?? getFallbackTransform(ratio);

      const savedPhoto = await saveEditedPhoto({
        sourceUri: source.uri,
        sourcePhotoId:
          mode === "overwrite" ? sourcePhoto?.sourcePhotoId : source.sourcePhotoId,
        targetPhotoId: mode === "overwrite" ? sourcePhoto?.id : undefined,
        replaceCreatedAt: mode === "overwrite" ? sourcePhoto?.createdAt : undefined,
        width: source.width,
        height: source.height,
        transform,
        localImageLimit: planEntitlements.localImageLimit
      });
      try {
        await backupPhotoIfEnabled({
          user,
          subscription,
          photo: savedPhoto
        });
      } catch (backupError) {
        console.error("편집 사진 자동 백업에 실패했습니다.", backupError);
        await recordBackupFailure({
          id: savedPhoto.id,
          kind: "photo",
          label: "편집 사진",
          message: getUserFacingErrorMessage(
            backupError,
            "클라우드 백업은 완료하지 못했습니다."
          )
        });
        Alert.alert(
          "백업 실패",
          "편집 결과는 현재 기기에 저장되었습니다. 클라우드 백업은 설정에서 다시 시도할 수 있습니다."
        );
      }

      await clearEditDraft();
      router.replace("/studio?tab=works" as Href);
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "편집 결과를 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmSaveEdit = () => {
    if (!canOverwriteSource) {
      void executeSaveEdit("new");
      return;
    }

    Alert.alert(
      "저장 방식 선택",
      "완료된 편집 작업물에 덮어쓸지, 새 작업물로 저장할지 선택해 주세요.",
      [
        { text: "취소", style: "cancel" },
        { text: "새로 저장", onPress: () => executeSaveEdit("new") },
        {
          text: "덮어쓰기",
          style: "destructive",
          onPress: () => executeSaveEdit("overwrite")
        }
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.ghostButton} onPress={() => router.back()}>
          <Text selectable={false} style={styles.ghostButtonText}>
            취소
          </Text>
        </Pressable>
        <Text selectable={false} style={styles.title}>
          사진 편집
        </Text>
        <Pressable
          android_disableSound
          disabled={isSaving || !source}
          style={[styles.saveButton, (!source || isSaving) && styles.disabledButton]}
          onPress={confirmSaveEdit}
        >
          <Text selectable={false} style={styles.saveButtonText}>
            {isSaving ? "저장 중" : "저장"}
          </Text>
        </Pressable>
      </View>

      <View
        style={[styles.canvasWrap, isCanvasExpanded && styles.canvasWrapExpanded]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setGuideMoveFrame({ width, height });
        }}
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.inverse} />
          </View>
        ) : (
          <EditablePhotoCanvas
            ref={canvasRef}
            uri={source?.uri ?? null}
            ratio={ratio}
            originalAspectRatio={originalAspectRatio}
            initialTransform={pendingTransform}
            initialTransformKey={transformApplyKey}
            guide={guide}
            guideVisible={guideVisible}
            guideSize={guideSize}
            guideStrokeWidth={guideStrokeWidth}
            guideColor={guideColor}
            guideLineOpacity={guideLineOpacity}
            guideOffsetX={guideOffsetX}
            guideOffsetY={guideOffsetY}
            guideOffsetFrameWidth={guideOffsetFrameWidth}
            guideOffsetFrameHeight={guideOffsetFrameHeight}
            gridGuideLinePositions={gridGuideLinePositions}
            guideShapePoints={guideShapePoints}
            onGuideFrameLayout={setGuideMoveFrame}
          />
        )}
        {isCanvasExpanded && isGuidePositionAdjusting ? (
          <GestureDetector gesture={guidePositionGesture}>
            <View
              collapsable={false}
              pointerEvents="box-only"
              style={styles.guideMoveLayer}
            >
              <Text selectable={false} style={styles.guideMoveText}>
                라인을 드래그하세요
              </Text>
            </View>
          </GestureDetector>
        ) : null}
        {isCanvasExpanded ? (
          <Pressable
            style={[
              styles.guideMoveButton,
              isGuidePositionAdjusting && styles.expandCanvasButtonActive,
              { bottom: bottomSafePadding }
            ]}
            onPress={
              isGuidePositionAdjusting
                ? stopGuidePositionAdjustment
                : startGuidePositionAdjustment
            }
          >
            <Text selectable={false} style={styles.expandCanvasButtonText}>
              {isGuidePositionAdjusting ? "이동 완료" : "라인 이동"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.expandCanvasButton, { bottom: bottomSafePadding }]}
          onPress={() => {
            if (isCanvasExpanded && isGuidePositionAdjusting) {
              stopGuidePositionAdjustment();
            }
            setIsCanvasExpanded((value) => !value);
          }}
        >
          <Text selectable={false} style={styles.expandCanvasButtonText}>
            {isCanvasExpanded ? "설정 열기" : "이미지만 보기"}
          </Text>
        </Pressable>
      </View>

      {!isCanvasExpanded ? (
      <View style={[styles.bottomPanel, { paddingBottom: bottomSafePadding }]}>
        <View style={styles.editPanelTabs}>
          {EDIT_PANEL_TABS.map((tab) => {
            const isActive = activeEditPanelTab === tab.value;

            return (
              <Pressable
                key={tab.value}
                style={[
                  styles.editPanelTab,
                  isActive && styles.editPanelTabActive
                ]}
                onPress={() => {
                  setActiveEditPanelTab(tab.value);
                  if (tab.value === "guide") {
                    setGuidePanelOpen(true);
                  }
                }}
              >
                <Text
                  selectable={false}
                  style={[
                    styles.editPanelTabText,
                    isActive && styles.editPanelTabTextActive
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          style={styles.editPanelScroll}
          contentContainerStyle={styles.editPanelScrollContent}
          showsVerticalScrollIndicator={false}
        >
        {availableDraft && showDraftPrompt ? (
          <View style={styles.draftPanel}>
            <View style={styles.draftCopy}>
              <Text selectable style={styles.draftTitle}>
                임시 저장된 편집이 있습니다
              </Text>
              <Text selectable style={styles.draftDetail}>
                {formatDraftTime(availableDraft.updatedAt)} 작업 상태에서 이어갈 수 있습니다.
              </Text>
            </View>
            <View style={styles.draftActions}>
              <Pressable style={styles.draftButton} onPress={resumeDraft}>
                <Text selectable={false} style={styles.draftButtonText}>
                  이어 작업하기
                </Text>
              </Pressable>
              <Pressable style={styles.draftGhostButton} onPress={removeDraft}>
                <Text selectable={false} style={styles.draftGhostButtonText}>
                  삭제
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {activeEditPanelTab === "image" ? (
          <>
        <View style={styles.sourceRow}>
          <View style={styles.sourceCopy}>
            <Text selectable style={styles.sourceTitle}>
              {sourcePhoto ? "저장된 사진을 불러왔습니다" : source ? "앨범 사진을 불러왔습니다" : "선택된 사진이 없습니다"}
            </Text>
            <Text selectable style={styles.sourceDetail}>
              {source
                ? `${source.width ?? 0} x ${source.height ?? 0} / ${ratio}`
                : "촬영한 사진이나 앨범 사진을 불러와 시작하세요."}
            </Text>
          </View>
          <Pressable style={styles.loadButton} onPress={pickPhoto}>
            <Text selectable={false} style={styles.loadButtonText}>
              사진 불러오기
            </Text>
          </Pressable>
        </View>

        <View style={styles.ratioRow}>
          {ratios.map((item) => {
            const isActive = ratio === item;

            return (
              <Pressable
                key={item}
                style={[styles.ratioChip, isActive && styles.ratioChipActive]}
                onPress={() => setRatio(item)}
              >
                <Text
                  selectable={false}
                  style={[styles.ratioText, isActive && styles.ratioTextActive]}
                >
                  {ratioDisplayLabel(item)}
                </Text>
              </Pressable>
            );
          })}
        </View>
          </>
        ) : null}

        {activeEditPanelTab === "guide" ? (
        <View style={styles.guidePanel}>
          <Pressable
            style={styles.guidePanelHeader}
            onPress={() => setGuidePanelOpen((value) => !value)}
          >
            <View style={styles.guidePanelCopy}>
              <Text selectable={false} style={styles.guidePanelTitle}>
                가이드라인
              </Text>
              <Text selectable={false} style={styles.guidePanelDetail}>
                {guideVisible ? "표시 중" : "숨김"} / {GUIDE_LABELS[guide]} / {guideSize}
              </Text>
            </View>
            <Text selectable={false} style={styles.guidePanelAction}>
              {guidePanelOpen ? "닫기" : "설정"}
            </Text>
          </Pressable>

          {guidePanelOpen ? (
            <View style={styles.guideControls}>
              <View style={styles.guideOptionRow}>
                {GUIDE_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.guideChip, guide === type && styles.guideChipActive]}
                    onPress={() => updateGuideType(type)}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.guideChipText,
                        guide === type && styles.guideChipTextActive
                      ]}
                    >
                      {GUIDE_LABELS[type]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.guideOptionRow}>
                {GUIDE_SIZE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.guideChip,
                      guideSize === option.value && styles.guideChipActive
                    ]}
                    onPress={() => updateGuideSize(option.value)}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.guideChipText,
                        guideSize === option.value && styles.guideChipTextActive
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <EditGuideSizeSlider
                value={guideSize}
                onChange={previewGuideSize}
                onCommit={commitGuideSize}
              />
              <View style={styles.guideOptionRow}>
                {GUIDE_STROKE_WIDTH_OPTIONS.map((strokeWidth) => {
                  const isActive = guideStrokeWidth === strokeWidth;

                  return (
                    <Pressable
                      key={strokeWidth}
                      style={[
                        styles.guideChip,
                        isActive && styles.guideChipActive
                      ]}
                      onPress={() => updateGuideStrokeWidth(strokeWidth)}
                    >
                      <Text
                        selectable={false}
                        style={[
                          styles.guideChipText,
                          isActive && styles.guideChipTextActive
                        ]}
                      >
                        {strokeWidth}px
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.guideColorRow}>
                {GUIDE_COLOR_OPTIONS.map((option) => (
                  <Pressable
                    key={option.label}
                    style={[
                      styles.guideColorOption,
                      guideColor === option.value && styles.guideColorOptionActive
                    ]}
                    onPress={() => updateGuideColor(option.value)}
                  >
                    <View
                      style={[
                        styles.guideColorSwatch,
                        { backgroundColor: option.value }
                      ]}
                    />
                    <Text selectable={false} style={styles.guideColorLabel}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[
                  styles.guideVisibilityButton,
                  guideVisible && styles.guideVisibilityButtonActive
                ]}
                onPress={() => updateGuideVisibility(!guideVisible)}
              >
                <Text
                  selectable={false}
                  style={[
                    styles.guideVisibilityText,
                    guideVisible && styles.guideVisibilityTextActive
                  ]}
                >
                  가이드 {guideVisible ? "숨기기" : "보이기"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        ) : null}

        {activeEditPanelTab === "image" ? (
        <View style={styles.toolRow}>
          <Pressable
            style={styles.toolButton}
            onPress={() => canvasRef.current?.straighten()}
          >
            <Text selectable={false} style={styles.toolButtonText}>
              수평 맞추기
            </Text>
          </Pressable>
          <Pressable
            style={styles.toolButton}
            onPress={() => canvasRef.current?.fillFrame()}
          >
            <Text selectable={false} style={styles.toolButtonText}>
              가득 채우기
            </Text>
          </Pressable>
          <Pressable
            style={styles.toolButton}
            onPress={() => canvasRef.current?.rotateRight()}
          >
            <Text selectable={false} style={styles.toolButtonText}>
              90도 회전
            </Text>
          </Pressable>
          <Pressable style={styles.toolButton} onPress={() => canvasRef.current?.reset()}>
            <Text selectable={false} style={styles.toolButtonText}>
              초기화
            </Text>
          </Pressable>
        </View>
        ) : null}

        {message ? (
          <Text selectable style={styles.message}>
            {message}
          </Text>
        ) : null}
        </ScrollView>
      </View>
      ) : null}
    </View>
  );
}

function EditGuideSizeSlider({
  value,
  onChange,
  onCommit
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbX = useSharedValue(0);
  const dragStartThumbX = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const thumbTranslateX = useDerivedValue(() => thumbX.value - 9);

  useEffect(() => {
    if (trackWidth <= 0) {
      return;
    }

    const ratio =
      (clampEditGuideSize(value) - GUIDE_SIZE_MIN) / (GUIDE_SIZE_MAX - GUIDE_SIZE_MIN);
    const nextX = Math.max(0, Math.min(1, ratio)) * trackWidth;
    if (!isDragging.value) {
      thumbX.value = nextX;
    }
  }, [isDragging, thumbX, trackWidth, value]);

  const sliderGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(trackWidth > 0)
        .hitSlop({ top: 10, bottom: 10, left: 10, right: 10 })
        .onBegin((event) => {
          isDragging.value = true;
          dragStartThumbX.value = Math.max(0, Math.min(trackWidth, event.x));
          thumbX.value = dragStartThumbX.value;
          runOnJS(onChange)(getGuideSizeFromTrackX(dragStartThumbX.value, trackWidth));
        })
        .onUpdate((event) => {
          const nextX = Math.max(
            0,
            Math.min(trackWidth, dragStartThumbX.value + event.translationX)
          );
          thumbX.value = nextX;
          runOnJS(onChange)(getGuideSizeFromTrackX(nextX, trackWidth));
        })
        .onFinalize(() => {
          isDragging.value = false;
          runOnJS(onCommit)(getGuideSizeFromTrackX(thumbX.value, trackWidth));
        }),
    [dragStartThumbX, isDragging, onChange, onCommit, thumbX, trackWidth]
  );

  return (
    <View style={styles.guideSizeSlider}>
      <View style={styles.guideSizeSliderHeader}>
        <Text selectable={false} style={styles.guideSizeSliderLabel}>
          드래그로 크기 조절
        </Text>
        <Text selectable={false} style={styles.guideSizeSliderValue}>
          {Math.round(value)}
        </Text>
      </View>
      <GestureDetector gesture={sliderGesture}>
        <Animated.View
          collapsable={false}
          style={styles.guideSizeTrack}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        >
          <View style={styles.guideSizeTrackBase} />
          <Animated.View style={[styles.guideSizeTrackFill, { width: thumbX }]} />
          <Animated.View
            style={[
              styles.guideSizeThumb,
              { transform: [{ translateX: thumbTranslateX }] }
            ]}
          />
        </Animated.View>
      </GestureDetector>
      <View style={styles.guideSizeSliderRange}>
        <Text selectable={false} style={styles.guideSizeSliderRangeText}>
          {GUIDE_SIZE_MIN}
        </Text>
        <Text selectable={false} style={styles.guideSizeSliderRangeText}>
          {GUIDE_SIZE_MAX}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink
  },
  topBar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: colors.ink
  },
  title: {
    color: colors.inverse,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  ghostButton: {
    minWidth: 68,
    minHeight: controls.compactHeight,
    justifyContent: "center"
  },
  ghostButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  saveButton: {
    minWidth: 68,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.inverse,
    backgroundColor: "transparent"
  },
  saveButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  disabledButton: {
    opacity: 0.45
  },
  canvasWrap: {
    flex: 1,
    minHeight: 240,
    position: "relative"
  },
  canvasWrapExpanded: {
    flex: 1
  },
  expandCanvasButton: {
    position: "absolute",
    zIndex: 10,
    right: 14,
    bottom: 14,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.78)",
    backgroundColor: "rgba(0, 0, 0, 0.72)"
  },
  guideMoveButton: {
    position: "absolute",
    zIndex: 10,
    right: 112,
    bottom: 14,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.78)",
    backgroundColor: "rgba(0, 0, 0, 0.72)"
  },
  expandCanvasButtonActive: {
    borderColor: colors.inverse,
    backgroundColor: "rgba(255, 255, 255, 0.18)"
  },
  expandCanvasButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideMoveLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 74,
    backgroundColor: "rgba(0, 0, 0, 0.03)"
  },
  guideMoveText: {
    color: colors.inverse,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.72)"
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  bottomPanel: {
    maxHeight: "48%",
    minHeight: 0,
    flexShrink: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: colors.background
  },
  editPanelTabs: {
    flexDirection: "row",
    gap: 8
  },
  editPanelTab: {
    flex: 1,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  editPanelTabActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  editPanelTabText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  editPanelTabTextActive: {
    color: colors.inverse
  },
  editPanelScroll: {
    flexShrink: 1,
    minHeight: 0
  },
  editPanelScrollContent: {
    gap: 12
  },
  draftPanel: {
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.surface
  },
  draftCopy: {
    gap: 4
  },
  draftTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  draftDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  draftActions: {
    flexDirection: "row",
    gap: 8
  },
  draftButton: {
    flex: 1,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  draftButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  draftGhostButton: {
    minWidth: 72,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  draftGhostButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  sourceCopy: {
    flex: 1,
    gap: 4
  },
  sourceTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  sourceDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  loadButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.text
  },
  loadButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  ratioRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  ratioChip: {
    minHeight: controls.compactHeight,
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  ratioChipActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  ratioText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  ratioTextActive: {
    color: colors.inverse
  },
  guidePanel: {
    gap: 10,
    paddingTop: 2
  },
  guidePanelHeader: {
    minHeight: controls.compactHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  guidePanelCopy: {
    flex: 1,
    gap: 3
  },
  guidePanelTitle: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guidePanelDetail: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  guidePanelAction: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideControls: {
    gap: 8
  },
  guideOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  guideChip: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  guideChipActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  guideChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideChipTextActive: {
    color: colors.inverse
  },
  guideSizeSlider: {
    gap: 8
  },
  guideSizeSliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  guideSizeSliderLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideSizeSliderValue: {
    minWidth: 34,
    color: colors.text,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  guideSizeTrack: {
    height: 30,
    justifyContent: "center",
    position: "relative"
  },
  guideSizeTrackBase: {
    height: 2,
    backgroundColor: colors.line
  },
  guideSizeTrackFill: {
    position: "absolute",
    left: 0,
    height: 2,
    backgroundColor: colors.text
  },
  guideSizeThumb: {
    position: "absolute",
    width: 18,
    height: 18,
    marginLeft: -9,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  guideSizeSliderRange: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  guideSizeSliderRangeText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  guideColorRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    gap: 4
  },
  guideColorOption: {
    flex: 1,
    minHeight: 42,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.line
  },
  guideColorOptionActive: {
    borderColor: colors.text
  },
  guideColorSwatch: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.darkLine
  },
  guideColorLabel: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideVisibilityButton: {
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  guideVisibilityButtonActive: {
    backgroundColor: colors.text
  },
  guideVisibilityText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideVisibilityTextActive: {
    color: colors.inverse
  },
  toolRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  toolButton: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  toolButtonActive: {
    borderColor: colors.text
  },
  toolButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  message: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  }
});
