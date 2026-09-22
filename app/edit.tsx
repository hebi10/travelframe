import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
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
import {
  runOnJS,
  useSharedValue
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EditablePhotoCanvas,
  type EditablePhotoCanvasHandle
} from "@/components/editable-photo-canvas";
import {
  bodyFrameDarkColors,
  bodyFrameDesign,
  bodyFrameTypography,
  colors,
  controls,
  typography
} from "@/constants/app-theme";
import type { GuideType } from "@/constants/camera-guides";
import {
  clearEditDraft,
  getEditDraft,
  isSameEditDraftSource,
  saveEditDraft,
  type PhotoEditDraft
} from "@/lib/photo-edit-draft";
import {
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

const ratios: PhotoRatioLabel[] = ["Original", "1:1", "3:4", "4:3", "4:5", "9:16", "16:9"];

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
        <View style={styles.editPanelHeader}>
          <View style={styles.editPanelHeaderCopy}>
            <Text selectable={false} style={styles.editPanelTitle}>
              이미지 편집
            </Text>
            <Text selectable={false} style={styles.editPanelDetail}>
              비율과 구도를 조정한 뒤 저장하세요.
            </Text>
          </View>
          <Feather name="edit-3" size={18} color={bodyFrameDarkColors.muted} />
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

          <View style={styles.sourceRow}>
            <View style={styles.sourceCopy}>
              <Text selectable style={styles.sourceTitle}>
                {sourcePhoto
                  ? "저장된 사진을 불러왔습니다"
                  : source
                    ? "앨범 사진을 불러왔습니다"
                    : "선택된 사진이 없습니다"}
              </Text>
              <Text selectable style={styles.sourceDetail}>
                {source
                  ? `${source.width ?? 0} × ${source.height ?? 0} · ${ratioDisplayLabel(ratio)}`
                  : "촬영한 사진이나 앨범 사진을 불러와 시작하세요."}
              </Text>
            </View>
            <Pressable style={styles.loadButton} onPress={pickPhoto}>
              <Feather name="image" size={16} color={bodyFrameDarkColors.text} />
              <Text selectable={false} style={styles.loadButtonText}>
                사진 불러오기
              </Text>
            </Pressable>
          </View>

          <View style={styles.sectionLabelRow}>
            <Text selectable={false} style={styles.sectionLabel}>
              화면 비율
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ratioRow}
          >
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
          </ScrollView>

          <View style={styles.sectionLabelRow}>
            <Text selectable={false} style={styles.sectionLabel}>
              빠른 편집
            </Text>
          </View>
          <View style={styles.toolRow}>
            <Pressable
              style={styles.toolButton}
              onPress={() => canvasRef.current?.straighten()}
            >
              <Feather name="minus" size={17} color={bodyFrameDarkColors.text} />
              <Text selectable={false} style={styles.toolButtonText}>
                수평 맞추기
              </Text>
            </Pressable>
            <Pressable
              style={styles.toolButton}
              onPress={() => canvasRef.current?.fillFrame()}
            >
              <Feather name="maximize" size={17} color={bodyFrameDarkColors.text} />
              <Text selectable={false} style={styles.toolButtonText}>
                가득 채우기
              </Text>
            </Pressable>
            <Pressable
              style={styles.toolButton}
              onPress={() => canvasRef.current?.rotateRight()}
            >
              <Feather name="rotate-cw" size={17} color={bodyFrameDarkColors.text} />
              <Text selectable={false} style={styles.toolButtonText}>
                90도 회전
              </Text>
            </Pressable>
            <Pressable style={styles.toolButton} onPress={() => canvasRef.current?.reset()}>
              <Feather name="refresh-ccw" size={17} color={bodyFrameDarkColors.text} />
              <Text selectable={false} style={styles.toolButtonText}>
                초기화
              </Text>
            </Pressable>
          </View>

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
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingBottom: 10,
    borderBottomWidth: bodyFrameDesign.borderWidth,
    borderBottomColor: bodyFrameDarkColors.line,
    backgroundColor: bodyFrameDarkColors.background
  },
  title: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  ghostButton: {
    minWidth: 68,
    minHeight: controls.compactHeight,
    justifyContent: "center"
  },
  ghostButtonText: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.button,
    fontWeight: "600",
    letterSpacing: 0
  },
  saveButton: {
    minWidth: 68,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: bodyFrameDarkColors.text,
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: bodyFrameDarkColors.text
  },
  saveButtonText: {
    color: bodyFrameDarkColors.inverse,
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
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
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "rgba(245, 245, 245, 0.72)",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "rgba(11, 11, 12, 0.88)"
  },
  guideMoveButton: {
    position: "absolute",
    zIndex: 10,
    right: 126,
    bottom: 14,
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "rgba(245, 245, 245, 0.72)",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "rgba(11, 11, 12, 0.88)"
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
    maxHeight: "52%",
    minHeight: 0,
    flexShrink: 1,
    gap: 14,
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingTop: 16,
    borderTopWidth: bodyFrameDesign.borderWidth,
    borderTopColor: bodyFrameDarkColors.line,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: bodyFrameDarkColors.background
  },
  editPanelHeader: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  editPanelHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  editPanelTitle: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  editPanelDetail: {
    color: bodyFrameDarkColors.muted,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18
  },
  editPanelScroll: {
    flexShrink: 1,
    minHeight: 0
  },
  editPanelScrollContent: {
    gap: 16,
    paddingBottom: 4
  },
  draftPanel: {
    gap: 12,
    padding: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: bodyFrameDarkColors.line,
    borderRadius: bodyFrameDesign.cardRadius,
    backgroundColor: bodyFrameDarkColors.surface
  },
  draftCopy: {
    gap: 4
  },
  draftTitle: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  draftDetail: {
    color: bodyFrameDarkColors.muted,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    letterSpacing: 0
  },
  draftActions: {
    flexDirection: "row",
    gap: 8
  },
  draftButton: {
    flex: 1,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: bodyFrameDarkColors.text
  },
  draftButtonText: {
    color: bodyFrameDarkColors.inverse,
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
    letterSpacing: 0
  },
  draftGhostButton: {
    minWidth: 72,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: bodyFrameDarkColors.line,
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: bodyFrameDarkColors.surfaceStrong
  },
  draftGhostButtonText: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
    letterSpacing: 0
  },
  sourceRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: bodyFrameDarkColors.line,
    borderRadius: bodyFrameDesign.cardRadius,
    backgroundColor: bodyFrameDarkColors.surface
  },
  sourceCopy: {
    flex: 1,
    gap: 4
  },
  sourceTitle: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  sourceDetail: {
    color: bodyFrameDarkColors.muted,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    letterSpacing: 0
  },
  loadButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: bodyFrameDarkColors.line,
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: bodyFrameDarkColors.surfaceStrong
  },
  loadButtonText: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
    letterSpacing: 0
  },
  sectionLabelRow: {
    minHeight: 22,
    justifyContent: "center"
  },
  sectionLabel: {
    color: bodyFrameDarkColors.muted,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "700"
  },
  ratioRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4
  },
  ratioChip: {
    minHeight: bodyFrameDesign.minTouchSize,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: bodyFrameDarkColors.line,
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: bodyFrameDarkColors.surfaceStrong
  },
  ratioChipActive: {
    borderColor: bodyFrameDarkColors.text,
    backgroundColor: bodyFrameDarkColors.text
  },
  ratioText: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
    letterSpacing: 0
  },
  ratioTextActive: {
    color: bodyFrameDarkColors.inverse
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
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: bodyFrameDarkColors.line,
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: bodyFrameDarkColors.surfaceStrong
  },
  toolButtonActive: {
    borderColor: colors.text
  },
  toolButtonText: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
    letterSpacing: 0
  },
  message: {
    color: bodyFrameDarkColors.muted,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    letterSpacing: 0
  }
});
