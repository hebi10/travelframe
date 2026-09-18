import { router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image as NativeImage,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
import { getBodyProjectById } from "@/lib/body-project-library";
import { deletePhoto, getPhotoById } from "@/lib/photo-library";
import { saveImageToLibrary } from "@/lib/trip-clip-export";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import type { BodyProject } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const getPhotoAspectRatio = (photo: PhotoItem) => {
  if (photo.width > 0 && photo.height > 0) {
    return photo.width / photo.height;
  }

  if (photo.ratioLabel === "1:1") return 1;
  if (photo.ratioLabel === "3:4") return 3 / 4;
  if (photo.ratioLabel === "4:3") return 4 / 3;
  if (photo.ratioLabel === "4:5") return 4 / 5;
  if (photo.ratioLabel === "9:16") return 9 / 16;
  if (photo.ratioLabel === "16:9") return 16 / 9;
  return 4 / 5;
};

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { palette } = useAppAppearance();
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<PhotoItem | null>(null);
  const [project, setProject] = useState<BodyProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingToDevice, setIsSavingToDevice] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPhoto = useCallback(async () => {
    if (!id) {
      setPhoto(null);
      setProject(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    try {
      const storedPhoto = await getPhotoById(id);
      const storedProject = storedPhoto?.projectId
        ? await getBodyProjectById(storedPhoto.projectId)
        : null;
      setPhoto(storedPhoto);
      setProject(storedProject);
    } catch (error) {
      setPhoto(null);
      setProject(null);
      setMessage(getUserFacingErrorMessage(error, "사진을 불러오지 못했습니다."));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadPhoto();
    }, [loadPhoto])
  );

  const returnToRecord = useCallback(() => {
    if (photo?.projectId) {
      router.replace({
        pathname: "/project/[id]",
        params: { id: photo.projectId }
      });
      return;
    }

    router.replace("/studio");
  }, [photo?.projectId]);

  const saveToDevice = async () => {
    if (!photo || isSavingToDevice) return;

    try {
      setIsSavingToDevice(true);
      setMessage(null);
      await saveImageToLibrary(photo.uri);
      setMessage("사진을 핸드폰 앨범에 저장했습니다.");
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "사진을 핸드폰에 저장하지 못했습니다."));
    } finally {
      setIsSavingToDevice(false);
    }
  };

  const showLoginRequiredForEditing = () => {
    Alert.alert(
      "로그인이 필요합니다",
      "사진 편집은 무료 로그인부터 사용할 수 있습니다.",
      [
        { text: "닫기", style: "cancel" },
        { text: "로그인하기", onPress: () => router.push("/account" as Href) }
      ]
    );
  };

  const removePhoto = async () => {
    if (!id || !photo || isDeleting) return;

    try {
      setIsDeleting(true);
      setMessage(null);
      await deletePhoto(id);
      returnToRecord();
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "사진을 삭제하지 못했습니다."));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "기록 사진을 삭제할까요?",
      "앱에 저장된 사진이 삭제됩니다. 프로젝트 기록 수에도 반영됩니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: () => void removePhoto() }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centerScreen, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.text} />
        <Text style={[styles.loadingText, { color: palette.muted }]}>
          기록을 불러오는 중입니다.
        </Text>
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={[styles.centerScreen, { backgroundColor: palette.background }]}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>
          사진을 찾을 수 없습니다.
        </Text>
        {message ? (
          <Text style={[styles.message, { color: palette.muted }]}>{message}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={[styles.secondaryButton, { borderColor: palette.line }]}
          onPress={() => router.replace("/studio")}
        >
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
            기록으로 돌아가기
          </Text>
        </Pressable>
      </View>
    );
  }

  const sequenceLabel = photo.sequence ? `#${photo.sequence}` : "기록";
  const projectLabel = project?.name ?? (photo.projectId ? "프로젝트 기록" : "기존 사진");

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
            accessibilityLabel="기록으로 돌아가기"
            style={[styles.iconButton, { borderColor: palette.line }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: palette.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.pageTitle, { color: palette.text }]}>기록 상세</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View
          style={[
            styles.heroFrame,
            {
              borderColor: palette.line,
              backgroundColor: palette.surfaceStrong
            }
          ]}
        >
          <NativeImage
            source={{ uri: photo.uri }}
            style={[
              styles.heroImage,
              {
                aspectRatio: getPhotoAspectRatio(photo)
              }
            ]}
            resizeMode="contain"
          />
        </View>

        <View style={styles.recordHeader}>
          <Text style={[styles.projectName, { color: palette.muted }]}>
            {projectLabel}
          </Text>
          <View style={styles.recordTitleRow}>
            <Text style={[styles.recordSequence, { color: palette.text }]}>
              {sequenceLabel}
            </Text>
            <Text style={[styles.recordDate, { color: palette.muted }]}>
              {formatDate(photo.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.recordSummary}>
          <View
            style={[
              styles.infoCard,
              { borderColor: palette.line, backgroundColor: palette.surface }
            ]}
          >
            <MetaRow
              label="프로젝트"
              value={projectLabel}
              textColor={palette.text}
              mutedColor={palette.muted}
            />
            <MetaRow
              label="기록 번호"
              value={photo.sequence ? `${photo.sequence}번째` : "없음"}
              textColor={palette.text}
              mutedColor={palette.muted}
            />
            <MetaRow
              label="촬영일"
              value={formatDate(photo.createdAt)}
              textColor={palette.text}
              mutedColor={palette.muted}
            />
          </View>

          <View
            style={[
              styles.infoCard,
              { borderColor: palette.line, backgroundColor: palette.surface }
            ]}
          >
            <MetaRow
              label="비율"
              value={photo.ratioLabel}
              textColor={palette.text}
              mutedColor={palette.muted}
            />
            <MetaRow
              label="해상도"
              value={`${photo.width} × ${photo.height}`}
              textColor={palette.text}
              mutedColor={palette.muted}
            />
            <MetaRow
              label="사진 상태"
              value={photo.edited ? "편집본" : "원본"}
              textColor={palette.text}
              mutedColor={palette.muted}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSavingToDevice}
            style={[
              styles.primaryButton,
              {
                backgroundColor: palette.text,
                opacity: isSavingToDevice ? 0.5 : 1
              }
            ]}
            onPress={() => void saveToDevice()}
          >
            <Text style={[styles.primaryButtonText, { color: palette.inverse }]}>
              {isSavingToDevice ? "저장 중" : "핸드폰 앨범에 저장"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={[styles.secondaryButton, { borderColor: palette.line }]}
            onPress={() => {
              if (!user) {
                showLoginRequiredForEditing();
                return;
              }

              router.push(`/edit?photoId=${photo.id}` as Href);
            }}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
              사진 편집
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isDeleting}
            style={[
              styles.deleteButton,
              { borderColor: palette.line, opacity: isDeleting ? 0.5 : 1 }
            ]}
            onPress={confirmDelete}
          >
            <Text style={[styles.deleteButtonText, { color: palette.muted }]}>
              {isDeleting ? "삭제 중" : "사진 삭제"}
            </Text>
          </Pressable>

          {message ? (
            <Text style={[styles.message, { color: palette.muted }]}>
              {message}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function MetaRow({
  label,
  value,
  textColor,
  mutedColor
}: {
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: mutedColor }]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.metaValue, { color: textColor }]}>
        {value}
      </Text>
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
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24
  },
  loadingText: {
    fontSize: bodyFrameTypography.body
  },
  topBar: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18
  },
  iconButton: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  backButtonText: {
    marginTop: -2,
    fontSize: 28,
    fontWeight: "400"
  },
  pageTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  topBarSpacer: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize
  },
  heroFrame: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    maxHeight: 560,
    overflow: "hidden",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  heroImage: {
    alignSelf: "center",
    width: "100%",
    maxHeight: 560
  },
  recordHeader: {
    gap: 6,
    marginTop: 18,
    marginBottom: 18
  },
  projectName: {
    fontSize: bodyFrameTypography.body,
    fontWeight: "500"
  },
  recordTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12
  },
  recordSequence: {
    fontSize: bodyFrameTypography.metric,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  recordDate: {
    flexShrink: 1,
    fontSize: bodyFrameTypography.caption,
    textAlign: "right"
  },
  recordSummary: {
    gap: 10
  },
  infoCard: {
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  metaRow: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  metaLabel: {
    flexShrink: 0,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "500"
  },
  metaValue: {
    flex: 1,
    fontSize: bodyFrameTypography.body,
    fontWeight: "600",
    textAlign: "right"
  },
  actions: {
    gap: 10,
    marginTop: 24
  },
  primaryButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  primaryButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  },
  secondaryButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  secondaryButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  deleteButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  deleteButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  emptyTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  message: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    textAlign: "center"
  }
});
