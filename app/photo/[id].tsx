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

import { colors, controls, spacing, typography } from "@/constants/app-theme";
import { deletePhoto, getPhotoById } from "@/lib/photo-library";
import { saveImageToLibrary } from "@/lib/trip-clip-export";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
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

  if (photo.ratioLabel === "1:1") {
    return 1;
  }

  if (photo.ratioLabel === "3:4") {
    return 3 / 4;
  }

  if (photo.ratioLabel === "4:5") {
    return 4 / 5;
  }

  if (photo.ratioLabel === "9:16") {
    return 9 / 16;
  }

  if (photo.ratioLabel === "16:9") {
    return 16 / 9;
  }

  return 4 / 5;
};

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + spacing.screen, spacing.screen);
  const [photo, setPhoto] = useState<PhotoItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingToDevice, setIsSavingToDevice] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPhoto = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const storedPhoto = await getPhotoById(id);
    setPhoto(storedPhoto);
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadPhoto();
    }, [loadPhoto])
  );

  const saveToDevice = async () => {
    if (!photo || isSavingToDevice) {
      return;
    }

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

  const removePhoto = async () => {
    if (!id || isDeleting) {
      return;
    }

    try {
      setIsDeleting(true);
      setMessage(null);
      await deletePhoto(id);
      router.replace("/studio");
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "사진을 삭제하지 못했습니다."));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert("사진을 삭제할까요?", "앱에 저장된 사진이 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: removePhoto }
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={styles.centerScreen}>
        <Text selectable style={styles.emptyTitle}>
          사진을 찾을 수 없습니다.
        </Text>
        <Pressable style={styles.darkButton} onPress={() => router.replace("/studio")}>
          <Text selectable={false} style={styles.darkButtonText}>
            편집으로 돌아가기
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomSafePadding }]}
      contentInsetAdjustmentBehavior="automatic"
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

      <View style={styles.header}>
        <Text selectable style={styles.eyebrow}>
          {photo.kind === "edited" ? "편집 사진" : "원본 사진"}
        </Text>
        <Text selectable style={styles.title}>
          {photo.ratioLabel} 프레임
        </Text>
        <Text selectable style={styles.detail}>
          촬영일 {formatDate(photo.createdAt)}
        </Text>
      </View>

      <View style={styles.metaPanel}>
        <MetaRow label="비율" value={photo.ratioLabel} />
        <MetaRow label="크기" value={`${photo.width} x ${photo.height}`} />
        <MetaRow label="편집 여부" value={photo.edited ? "완료" : "원본"} />
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={isSavingToDevice}
          style={[styles.darkButton, isSavingToDevice && styles.disabledButton]}
          onPress={saveToDevice}
        >
          <Text selectable={false} style={styles.darkButtonText}>
            {isSavingToDevice ? "저장 중" : "핸드폰에 저장"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.lightButton}
          onPress={() => router.push(`/edit?photoId=${photo.id}` as Href)}
        >
          <Text selectable={false} style={styles.lightButtonText}>
            사진 편집
          </Text>
        </Pressable>
        <Pressable
          disabled={isDeleting}
          style={[styles.deleteButton, isDeleting && styles.disabledButton]}
          onPress={confirmDelete}
        >
          <Text selectable={false} style={styles.deleteButtonText}>
            사진 삭제
          </Text>
        </Pressable>
        {message ? (
          <Text selectable style={styles.message}>
            {message}
          </Text>
        ) : null}
      </View>
    </ScrollView>
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
  heroImage: {
    width: "100%",
    maxHeight: 520,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink
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
  deleteButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  deleteButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  disabledButton: {
    opacity: 0.5
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
