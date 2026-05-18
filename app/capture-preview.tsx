import { Image } from "expo-image";
import { router, type Href, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, controls, typography } from "@/constants/app-theme";
import { deleteLocalFile, getPhotoById, saveCapturedPhoto } from "@/lib/photo-library";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import type { PhotoItem } from "@/types/photo";

export default function CapturePreviewScreen() {
  const { id, uri, width, height } = useLocalSearchParams<{
    id?: string;
    uri?: string;
    width?: string;
    height?: string;
  }>();
  const [photo, setPhoto] = useState<PhotoItem | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPhoto = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      const storedPhoto = await getPhotoById(id);
      if (isMounted) {
        setPhoto(storedPhoto);
        setIsLoading(false);
      }
    };

    loadPhoto();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const previewUri = photo?.uri ?? uri;
  const parsedWidth = width ? Number(width) : undefined;
  const parsedHeight = height ? Number(height) : undefined;

  const usePhoto = async () => {
    if (isSaving) {
      return;
    }

    if (id) {
      router.replace(`/photo/${id}` as Href);
      return;
    }

    if (!uri) {
      router.replace("/studio");
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      const savedPhoto = await saveCapturedPhoto({
        uri,
        width: Number.isFinite(parsedWidth) ? parsedWidth : undefined,
        height: Number.isFinite(parsedHeight) ? parsedHeight : undefined
      });
      try {
        await deleteLocalFile(uri);
      } catch (cleanupError) {
        console.error("임시 촬영 파일을 정리하지 못했습니다.", cleanupError);
      }
      router.replace(`/photo/${savedPhoto.id}` as Href);
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "사진을 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const retakePhoto = async () => {
    if (!id) {
      try {
        await deleteLocalFile(uri);
      } catch (error) {
        console.error("임시 촬영 파일을 정리하지 못했습니다.", error);
      }
    }

    router.back();
  };

  return (
    <View style={styles.screen}>
      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.inverse} />
        </View>
      ) : previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.image} contentFit="contain" />
      ) : (
        <View style={styles.emptyState}>
          <Text selectable style={styles.emptyTitle}>
            사진을 찾을 수 없습니다.
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text selectable style={styles.title}>
          촬영 미리보기
        </Text>
        <Text selectable style={styles.detail}>
          가이드는 촬영을 돕는 화면 표시이며 실제 사진에는 저장되지 않습니다.
        </Text>
        {message ? (
          <Text selectable style={styles.message}>
            {message}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={retakePhoto}>
            <Text selectable={false} style={styles.secondaryButtonText}>
              다시 촬영
            </Text>
          </Pressable>
          <Pressable
            disabled={isSaving || !previewUri}
            style={[styles.primaryButton, (isSaving || !previewUri) && styles.disabledButton]}
            onPress={usePhoto}
          >
            <Text selectable={false} style={styles.primaryButtonText}>
              {isSaving ? "저장 중" : "사진 사용"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink
  },
  image: {
    flex: 1
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    color: colors.inverse,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  footer: {
    gap: 10,
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.18)"
  },
  title: {
    color: colors.inverse,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0
  },
  detail: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  },
  message: {
    color: colors.inverse,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 8
  },
  primaryButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.inverse,
    backgroundColor: "transparent"
  },
  primaryButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  secondaryButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)"
  },
  secondaryButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  disabledButton: {
    opacity: 0.45
  }
});
