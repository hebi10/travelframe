import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image as NativeImage,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { colors, controls, typography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import { getAppSettings } from "@/lib/app-settings";
import { useAuth } from "@/lib/auth-context";
import { recordBackupFailure } from "@/lib/backup-failure-queue";
import {
  backupPhotoIfEnabled,
  subscribeCloudBackupOverview,
  type CloudBackupOverview
} from "@/lib/cloud-backup";
import {
  CLOUD_BACKUP_IMAGE_WORK_LIMIT,
  CLOUD_BACKUP_PHOTO_LIMIT,
  CLOUD_BACKUP_VIDEO_LIMIT
} from "@/lib/cloud-backup-limits";
import { deletePhoto, getPhotos, saveCapturedPhoto } from "@/lib/photo-library";
import { isCreatorSubscriptionActive } from "@/lib/subscription";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { deleteMadeVideo, getMadeVideos } from "@/lib/video-library";
import { deleteImageBundleWork, getImageBundleWorks } from "@/lib/work-library";
import type { PhotoItem } from "@/types/photo";
import type { MadeVideoItem } from "@/types/video";
import type { ImageBundleWorkItem } from "@/types/work";

type StudioTab = "photos" | "videos" | "works";
type PageSize = 6 | 10 | 20;
type StudioWorkItem =
  | { kind: "single-image"; item: PhotoItem; createdAt: string }
  | { kind: "image-bundle"; item: ImageBundleWorkItem; createdAt: string }
  | { kind: "video"; item: MadeVideoItem; createdAt: string };

type ImportProgress = {
  percent: number;
  detail: string;
};

const tabs: { label: string; value: StudioTab }[] = [
  { label: "사진", value: "photos" },
  { label: "동영상", value: "videos" },
  { label: "작업물", value: "works" }
];

const PAGE_SIZE_OPTIONS: PageSize[] = [6, 10, 20];
const initialBackupOverview: CloudBackupOverview = {
  photoCount: 0,
  imageBundleCount: 0,
  videoCount: 0,
  imageBackupBytes: 0,
  deleteAfter: null,
  status: "none",
  backedUpAt: null,
  deletedAt: null
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
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

export default function StudioScreen() {
  const router = useRouter();
  const { palette } = useAppAppearance();
  const { user, subscription } = useAuth();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<StudioTab>("photos");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videos, setVideos] = useState<MadeVideoItem[]>([]);
  const [imageBundles, setImageBundles] = useState<ImageBundleWorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportingImage, setIsImportingImage] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(6);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(false);
  const [backupOverview, setBackupOverview] =
    useState<CloudBackupOverview>(initialBackupOverview);

  const loadStudio = useCallback(async () => {
    setIsLoading(true);
    const [storedPhotos, storedVideos, storedImageBundles, settings] = await Promise.all([
      getPhotos(),
      getMadeVideos(),
      getImageBundleWorks(),
      getAppSettings()
    ]);
    setPhotos(storedPhotos);
    setVideos(storedVideos);
    setImageBundles(storedImageBundles);
    setCloudBackupEnabled(settings.cloudBackupEnabled);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStudio();
    }, [loadStudio])
  );

  useEffect(
    () =>
      subscribeCloudBackupOverview({
        user,
        onChange: setBackupOverview
      }),
    [user]
  );

  useEffect(() => {
    if (tab === "photos" || tab === "videos" || tab === "works") {
      setActiveTab(tab);
    }

    if (tab === "edit") {
      setActiveTab("videos");
    }
  }, [tab]);

  const setSectionPage = (key: string, page: number) => {
    setPages((current) => ({
      ...current,
      [key]: Math.max(0, page)
    }));
  };

  const changePageSize = (nextSize: PageSize) => {
    setPageSize(nextSize);
    setPages({});
  };

  const confirmDeletePhoto = (photo: PhotoItem) => {
    Alert.alert("사진을 삭제할까요?", "앱에 저장된 사진이 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await deletePhoto(photo.id);
          await loadStudio();
        }
      }
    ]);
  };

  const confirmDeleteWork = (work: StudioWorkItem) => {
    Alert.alert("작업물을 삭제할까요?", "앱에 저장된 작업물 기록이 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          if (work.kind === "video") {
            await deleteMadeVideo(work.item.id);
          } else if (work.kind === "image-bundle") {
            await deleteImageBundleWork(work.item.id);
          } else {
            await deletePhoto(work.item.id);
          }
          await loadStudio();
        }
      }
    ]);
  };

  const importImageToApp = async () => {
    if (isImportingImage) {
      return;
    }

    try {
      setIsImportingImage(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);

      if (!permission.granted) {
        Alert.alert("권한 필요", "이미지를 앱에 저장하려면 앨범 접근 권한이 필요합니다.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 20,
        allowsEditing: false,
        quality: 1
      });

      if (result.canceled) {
        return;
      }

      const importAssets = result.assets.filter((asset) => Boolean(asset.uri));
      if (importAssets.length === 0) {
        return;
      }

      let backupFailureCount = 0;
      setImportProgress({
        percent: 0,
        detail: `선택한 이미지 ${importAssets.length}장을 저장할 준비를 하고 있습니다.`
      });

      for (const [index, asset] of importAssets.entries()) {
        const savedPhoto = await saveCapturedPhoto({
          uri: asset.uri,
          width: asset.width,
          height: asset.height
        });

        setImportProgress({
          percent: ((index + 0.5) / importAssets.length) * 100,
          detail: `이미지를 앱에 저장하는 중입니다. ${index + 1}/${importAssets.length}`
        });

        try {
          await backupPhotoIfEnabled({
            user,
            subscription,
            photo: savedPhoto
          });
        } catch (backupError) {
          backupFailureCount += 1;
          console.error("가져온 사진 자동 백업에 실패했습니다.", backupError);
          await recordBackupFailure({
            id: savedPhoto.id,
            kind: "photo",
            label: "가져온 사진",
            message: getUserFacingErrorMessage(
              backupError,
              "클라우드 백업은 완료하지 못했습니다."
            )
          });
        }

        setImportProgress({
          percent: ((index + 1) / importAssets.length) * 100,
          detail: `이미지를 앱에 저장하는 중입니다. ${index + 1}/${importAssets.length}`
        });
      }

      await loadStudio();
      setActiveTab("photos");
      if (backupFailureCount > 0) {
        Alert.alert(
          "백업 실패",
          `선택한 이미지는 현재 기기에 저장되었습니다. ${backupFailureCount}장은 클라우드 백업을 설정에서 다시 시도할 수 있습니다.`
        );
      }
      Alert.alert(
        "저장 완료",
        `선택한 이미지 ${importAssets.length}장을 앱 사진 목록에 저장했습니다.`
      );
    } catch (error) {
      Alert.alert(
        "저장 실패",
        getUserFacingErrorMessage(error, "이미지를 앱에 저장하지 못했습니다.")
      );
    } finally {
      setIsImportingImage(false);
      setImportProgress(null);
    }
  };

  const capturedPhotos = photos.filter((photo) => photo.kind === "original");
  const editedPhotos = photos.filter((photo) => photo.edited);
  const singleImageWorks: StudioWorkItem[] = editedPhotos.map((item) => ({
    kind: "single-image",
    item,
    createdAt: item.createdAt
  }));
  const imageBundleWorks: StudioWorkItem[] = imageBundles.map((item) => ({
    kind: "image-bundle",
    item,
    createdAt: item.createdAt
  }));
  const videoWorks: StudioWorkItem[] = videos.map((item) => ({
    kind: "video",
    item,
    createdAt: item.createdAt
  }));
  const workCount =
    singleImageWorks.length + imageBundleWorks.length + videoWorks.length;
  const videoWorkCount = imageBundleWorks.length + videoWorks.length;
  const shouldShowBackupUsage =
    Boolean(user) && cloudBackupEnabled && isCreatorSubscriptionActive(subscription);
  const isDark = palette.background !== colors.background;
  const filledButtonStyle = {
    borderColor: palette.text,
    backgroundColor: isDark ? "transparent" : palette.text
  };
  const filledButtonTextStyle = {
    color: isDark ? palette.text : palette.inverse
  };
  const panelStyle = {
    borderColor: palette.text,
    backgroundColor: palette.background
  };

  return (
    <>
    <ScreenShell
      eyebrow="편집"
      title="사진과 영상을 관리하세요."
      description="촬영 사진을 편집하고, 여행 클립을 만들고, 저장한 영상을 다시 확인합니다."
      safeTop
    >
      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;

          return (
            <Pressable
              key={tab.value}
              style={[
                styles.tab,
                { borderColor: palette.line, backgroundColor: palette.background },
                isActive && styles.tabActive,
                isActive && filledButtonStyle
              ]}
              onPress={() => setActiveTab(tab.value)}
            >
              <Text
                selectable={false}
                style={[
                  styles.tabText,
                  { color: palette.text },
                  isActive && styles.tabTextActive,
                  isActive && filledButtonTextStyle
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PageSizeSelector value={pageSize} onChange={changePageSize} />

      {activeTab === "photos" ? (
        <>
          <SectionBlock title="이미지 저장">
            <Pressable
              disabled={isImportingImage}
              style={({ pressed }) => [
                styles.importImageCta,
                panelStyle,
                pressed && styles.pressed,
                isImportingImage && styles.disabledAction
              ]}
              onPress={importImageToApp}
            >
              <View style={styles.clipCopy}>
                <Text selectable style={styles.clipTitle}>
                  앱에 이미지 저장
                </Text>
                <Text selectable style={styles.clipDetail}>
                  핸드폰 앨범에서 이미지를 여러 장 골라 앱 사진 목록에 보관합니다.
                </Text>
              </View>
              <View style={[styles.clipAction, filledButtonStyle]}>
                <Text selectable={false} style={[styles.clipActionText, filledButtonTextStyle]}>
                  {isImportingImage ? "저장 중" : "이미지 선택"}
                </Text>
              </View>
            </Pressable>
          </SectionBlock>

          <SectionBlock title="사진">
          {shouldShowBackupUsage ? (
            <BackupUsageBadge
              count={backupOverview.photoCount}
              limit={CLOUD_BACKUP_PHOTO_LIMIT}
            />
          ) : null}
          {isLoading ? (
            <LoadingState />
          ) : capturedPhotos.length > 0 ? (
            <PaginatedPhotoGrid
              items={capturedPhotos}
              page={pages.photos ?? 0}
              pageSize={pageSize}
              router={router}
              onDeletePhoto={confirmDeletePhoto}
              onPageChange={(page) => setSectionPage("photos", page)}
            />
          ) : (
            <EmptyState
              title="아직 사진이 없습니다."
              detail="카메라에서 구도 가이드로 촬영하면 이곳에 사진이 표시됩니다."
            />
          )}
          </SectionBlock>
        </>
      ) : null}

      {activeTab === "videos" ? (
        <>
          <SectionBlock title="영상 만들기">
            <Pressable
              style={({ pressed }) => [styles.clipCta, panelStyle, pressed && styles.pressed]}
              onPress={() => router.push("/trip-clip")}
            >
              <View style={styles.clipCopy}>
                <Text selectable style={styles.clipTitle}>
                  영상 만들기
                </Text>
                <Text selectable style={styles.clipDetail}>
                  여러 사진을 선택해 순서, 비율, 음악을 정하고 영상으로 저장합니다.
                </Text>
              </View>
              <View style={[styles.clipAction, filledButtonStyle]}>
                <Text selectable={false} style={[styles.clipActionText, filledButtonTextStyle]}>
                  생성 시작
                </Text>
              </View>
            </Pressable>
          </SectionBlock>

          {isLoading ? (
            <SectionBlock title="동영상 작업">
              <LoadingState />
            </SectionBlock>
          ) : videoWorkCount > 0 ? (
            <>
              <WorkSection
                title="영상 만들기 작업"
                emptyDetail="영상 만들기에서 저장한 이미지 작업이 이곳에 표시됩니다."
                items={imageBundleWorks}
                page={pages.videoImageBundles ?? 0}
                pageSize={pageSize}
                router={router}
                onDeleteWork={confirmDeleteWork}
                onPageChange={(page) => setSectionPage("videoImageBundles", page)}
                backupUsage={
                  shouldShowBackupUsage
                    ? {
                        count: backupOverview.imageBundleCount,
                        limit: CLOUD_BACKUP_IMAGE_WORK_LIMIT
                      }
                    : null
                }
              />
              <WorkSection
                title="저장한 영상"
                emptyDetail="여행 클립을 저장하면 이곳에 표시됩니다."
                items={videoWorks}
                page={pages.videoWorks ?? 0}
                pageSize={pageSize}
                router={router}
                onDeleteWork={confirmDeleteWork}
                onPageChange={(page) => setSectionPage("videoWorks", page)}
                backupUsage={
                  shouldShowBackupUsage
                    ? {
                        count: backupOverview.videoCount,
                        limit: CLOUD_BACKUP_VIDEO_LIMIT
                      }
                    : null
                }
              />
            </>
          ) : (
            <SectionBlock title="동영상 작업">
              <EmptyState
                title="아직 동영상 작업물이 없습니다."
                detail="영상 만들기에서 사진을 선택하고 저장하면 이곳에 표시됩니다."
              />
            </SectionBlock>
          )}
        </>
      ) : null}

      {activeTab === "works" ? (
        <>
          {isLoading ? (
            <SectionBlock title="작업물">
              <LoadingState />
            </SectionBlock>
          ) : workCount > 0 ? (
            <>
              <WorkSection
                title="단일 이미지"
                emptyDetail="사진을 편집하면 이곳에 단일 이미지 작업물이 표시됩니다."
                items={singleImageWorks}
                page={pages.singleImages ?? 0}
                pageSize={pageSize}
                router={router}
                onDeleteWork={confirmDeleteWork}
                onPageChange={(page) => setSectionPage("singleImages", page)}
                backupUsage={
                  shouldShowBackupUsage
                    ? {
                        count: backupOverview.photoCount,
                        limit: CLOUD_BACKUP_PHOTO_LIMIT
                      }
                    : null
                }
              />
              <WorkSection
                title="영상 만들기 작업"
                emptyDetail="영상 만들기에서 저장한 이미지 작업이 이곳에 표시됩니다."
                items={imageBundleWorks}
                page={pages.imageBundles ?? 0}
                pageSize={pageSize}
                router={router}
                onDeleteWork={confirmDeleteWork}
                onPageChange={(page) => setSectionPage("imageBundles", page)}
                backupUsage={
                  shouldShowBackupUsage
                    ? {
                        count: backupOverview.imageBundleCount,
                        limit: CLOUD_BACKUP_IMAGE_WORK_LIMIT
                      }
                    : null
                }
              />
              <WorkSection
                title="영상"
                emptyDetail="여행 클립을 저장하면 이곳에 표시됩니다."
                items={videoWorks}
                page={pages.videos ?? 0}
                pageSize={pageSize}
                router={router}
                onDeleteWork={confirmDeleteWork}
                onPageChange={(page) => setSectionPage("videos", page)}
                backupUsage={
                  shouldShowBackupUsage
                    ? {
                        count: backupOverview.videoCount,
                        limit: CLOUD_BACKUP_VIDEO_LIMIT
                      }
                    : null
                }
              />
            </>
          ) : (
            <SectionBlock title="작업물">
              <EmptyState
                title="아직 작업물이 없습니다."
                detail="단일 이미지 편집, 영상 만들기 작업, 저장한 영상이 이곳에 표시됩니다."
              />
            </SectionBlock>
          )}
        </>
      ) : null}
      <Modal
        animationType="fade"
        transparent
        visible={isImportingImage && Boolean(importProgress)}
        onRequestClose={() => undefined}
      >
        <View style={styles.importProgressBackdrop}>
          <View style={[styles.importProgressPanel, panelStyle]}>
            {importProgress ? (
              <>
                <View style={styles.importProgressHeader}>
                  <ActivityIndicator color={palette.text} />
                  <View style={styles.importProgressCopy}>
                    <Text selectable style={styles.importProgressTitle}>
                      이미지 저장 중
                    </Text>
                    <Text selectable style={styles.importProgressDetail}>
                      이미지를 앱에 저장하는 중입니다.
                    </Text>
                  </View>
                </View>
                <Text selectable style={styles.importProgressDetail}>
                  {importProgress.detail}
                </Text>
                <View style={styles.importProgressTrack}>
                  <View
                    style={[
                      styles.importProgressFill,
                      { width: `${Math.max(0, Math.min(100, importProgress.percent))}%` }
                    ]}
                  />
                </View>
                <Text selectable style={styles.importProgressText}>
                  {Math.round(importProgress.percent)}%
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenShell>
    <AppGuideOverlay tabKey="studio" />
    </>
  );
}

function PhotoCard({
  photo,
  router,
  onDelete
}: {
  photo: PhotoItem;
  router: ReturnType<typeof useRouter>;
  onDelete: (photo: PhotoItem) => void;
}) {
  const { palette } = useAppAppearance();
  const isDark = palette.background !== colors.background;
  const filledButtonStyle = {
    borderWidth: isDark ? 1 : 0,
    borderColor: palette.text,
    backgroundColor: isDark ? "transparent" : palette.text
  };
  const filledButtonTextStyle = {
    color: isDark ? palette.text : palette.inverse
  };
  const secondaryButtonStyle = {
    borderColor: palette.line,
    backgroundColor: palette.background
  };
  const secondaryButtonTextStyle = {
    color: palette.text
  };
  const secondaryDeleteButtonTextStyle = {
    color: palette.muted
  };
  const thumbnailStyle = {
    borderColor: palette.line,
    backgroundColor: palette.surface
  };
  const primaryMetaTextStyle = {
    color: palette.text
  };
  const secondaryMetaTextStyle = {
    color: palette.muted
  };

  return (
    <View style={styles.photoCard}>
      <Pressable onPress={() => router.push(`/photo/${photo.id}` as Href)}>
        <NativeImage
          source={{ uri: photo.uri }}
          style={[styles.thumbnail, thumbnailStyle]}
          resizeMode="cover"
        />
      </Pressable>
      <View style={styles.photoMeta}>
        <Text selectable style={[styles.photoDate, primaryMetaTextStyle]}>
          {formatDate(photo.createdAt)}
        </Text>
        <Text selectable style={[styles.metaText, secondaryMetaTextStyle]}>
          {photo.ratioLabel} / {photo.edited ? "편집됨" : "원본"}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          style={[styles.cardButton, filledButtonStyle]}
          onPress={() => router.push(`/edit?photoId=${photo.id}` as Href)}
        >
          <Text selectable={false} style={[styles.cardButtonText, filledButtonTextStyle]}>
            편집
          </Text>
        </Pressable>
        <Pressable
          style={[styles.cardLightButton, secondaryButtonStyle]}
          onPress={() => router.push(`/photo/${photo.id}` as Href)}
        >
          <Text selectable={false} style={[styles.cardLightButtonText, secondaryButtonTextStyle]}>
            보기
          </Text>
        </Pressable>
        <Pressable
          style={[styles.cardLightButton, secondaryButtonStyle]}
          onPress={() => onDelete(photo)}
        >
          <Text
            selectable={false}
            style={[styles.cardDeleteButtonText, secondaryDeleteButtonTextStyle]}
          >
            삭제
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PageSizeSelector({
  value,
  onChange
}: {
  value: PageSize;
  onChange: (value: PageSize) => void;
}) {
  const { palette } = useAppAppearance();
  const isDark = palette.background !== colors.background;
  const filledButtonStyle = {
    borderColor: palette.text,
    backgroundColor: isDark ? "transparent" : palette.text
  };
  const filledButtonTextStyle = {
    color: isDark ? palette.text : palette.inverse
  };

  return (
    <View style={styles.pageSizeBar}>
      <Text selectable={false} style={styles.pageSizeLabel}>
        표시
      </Text>
      <View style={styles.pageSizeOptions}>
        {PAGE_SIZE_OPTIONS.map((option) => {
          const isActive = value === option;

          return (
            <Pressable
              key={option}
              style={[
                styles.pageSizeButton,
                { borderColor: palette.line, backgroundColor: palette.background },
                isActive && styles.pageSizeButtonActive,
                isActive && filledButtonStyle
              ]}
              onPress={() => onChange(option)}
            >
              <Text
                selectable={false}
                style={[
                  styles.pageSizeButtonText,
                  { color: palette.text },
                  isActive && styles.pageSizeButtonTextActive,
                  isActive && filledButtonTextStyle
                ]}
              >
                {option}개
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function getPaginatedItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages
  };
}

function PaginatedPhotoGrid({
  items,
  page,
  pageSize,
  router,
  onDeletePhoto,
  onPageChange
}: {
  items: PhotoItem[];
  page: number;
  pageSize: PageSize;
  router: ReturnType<typeof useRouter>;
  onDeletePhoto: (photo: PhotoItem) => void;
  onPageChange: (page: number) => void;
}) {
  const result = getPaginatedItems(items, page, pageSize);

  return (
    <View style={styles.paginatedList}>
      <View style={styles.photoGrid}>
        {result.items.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            router={router}
            onDelete={onDeletePhoto}
          />
        ))}
      </View>
      <PaginationControls
        page={result.page}
        totalPages={result.totalPages}
        totalItems={items.length}
        onPageChange={onPageChange}
      />
    </View>
  );
}

function BackupUsageBadge({ count, limit }: { count: number; limit: number }) {
  return (
    <View style={styles.backupUsageBadge}>
      <Text selectable style={styles.backupUsageText}>
        클라우드 백업 {count}/{limit}
      </Text>
    </View>
  );
}

function WorkSection({
  title,
  emptyDetail,
  items,
  page,
  pageSize,
  router,
  onDeleteWork,
  onPageChange,
  backupUsage
}: {
  title: string;
  emptyDetail: string;
  items: StudioWorkItem[];
  page: number;
  pageSize: PageSize;
  router: ReturnType<typeof useRouter>;
  onDeleteWork: (work: StudioWorkItem) => void;
  onPageChange: (page: number) => void;
  backupUsage?: { count: number; limit: number } | null;
}) {
  const result = getPaginatedItems(items, page, pageSize);

  return (
    <SectionBlock title={title}>
      {backupUsage ? (
        <BackupUsageBadge count={backupUsage.count} limit={backupUsage.limit} />
      ) : null}
      {items.length > 0 ? (
        <View style={styles.paginatedList}>
          <View style={styles.videoList}>
            {result.items.map((work) => (
              <WorkCard
                key={`${work.kind}-${work.item.id}`}
                work={work}
                router={router}
                onDelete={onDeleteWork}
              />
            ))}
          </View>
          <PaginationControls
            page={result.page}
            totalPages={result.totalPages}
            totalItems={items.length}
            onPageChange={onPageChange}
          />
        </View>
      ) : (
        <EmptyState title={`${title} 작업물이 없습니다.`} detail={emptyDetail} />
      )}
    </SectionBlock>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalItems,
  onPageChange
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <Text selectable={false} style={styles.paginationMeta}>
        총 {totalItems}개
      </Text>
    );
  }

  return (
    <View style={styles.paginationBar}>
      <Pressable
        disabled={page <= 0}
        style={[styles.paginationButton, page <= 0 && styles.paginationButtonDisabled]}
        onPress={() => onPageChange(page - 1)}
      >
        <Text selectable={false} style={styles.paginationButtonText}>
          이전
        </Text>
      </Pressable>
      <Text selectable={false} style={styles.paginationMeta}>
        {page + 1} / {totalPages} · 총 {totalItems}개
      </Text>
      <Pressable
        disabled={page >= totalPages - 1}
        style={[
          styles.paginationButton,
          page >= totalPages - 1 && styles.paginationButtonDisabled
        ]}
        onPress={() => onPageChange(page + 1)}
      >
        <Text selectable={false} style={styles.paginationButtonText}>
          다음
        </Text>
      </Pressable>
    </View>
  );
}

function WorkCard({
  work,
  router,
  onDelete
}: {
  work: StudioWorkItem;
  router: ReturnType<typeof useRouter>;
  onDelete: (work: StudioWorkItem) => void;
}) {
  if (work.kind === "single-image") {
    const photo = work.item;

    return (
      <View style={styles.videoCard}>
        <NativeImage source={{ uri: photo.uri }} style={styles.videoThumb} resizeMode="cover" />
        <Pressable
          style={({ pressed }) => [styles.videoCopy, pressed && styles.pressed]}
          onPress={() => router.push(`/photo/${photo.id}` as Href)}
        >
          <Text selectable style={styles.videoKind}>
            단일 이미지
          </Text>
          <Text selectable style={styles.videoTitle}>
            편집 이미지
          </Text>
          <Text selectable style={styles.metaText}>
            {formatDate(photo.createdAt)} / {photo.ratioLabel}
          </Text>
          <Text selectable style={styles.metaText}>
            사진 편집 결과
          </Text>
        </Pressable>
        <View style={styles.workActions}>
          <Pressable
            style={styles.workEditButton}
            onPress={() => router.push(`/edit?photoId=${photo.id}` as Href)}
          >
            <Text selectable={false} style={styles.workEditButtonText}>
              다시 편집
            </Text>
          </Pressable>
          <Pressable
            style={styles.workDeleteButton}
            onPress={() => onDelete(work)}
          >
            <Text selectable={false} style={styles.workDeleteButtonText}>
              삭제
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (work.kind === "video") {
    const video = work.item;

    return (
      <View style={styles.videoCard}>
        {video.coverUri ? (
          <Image source={{ uri: video.coverUri }} style={styles.videoThumb} contentFit="cover" />
        ) : (
          <View style={styles.videoThumbEmpty} />
        )}
        <Pressable
          style={({ pressed }) => [styles.videoCopy, pressed && styles.pressed]}
          onPress={() => router.push(`/video/${video.id}` as Href)}
        >
          <Text selectable style={styles.videoKind}>
            저장한 영상
          </Text>
          <Text selectable style={styles.videoTitle}>
            {video.title}
          </Text>
          <Text selectable style={styles.metaText}>
            {formatDate(video.createdAt)} / {video.ratio} / {formatDuration(video.duration)}
          </Text>
          <Text selectable style={styles.metaText}>
            사진 {video.photoIds.length}장 / {video.musicLabel}
          </Text>
        </Pressable>
        <View style={styles.workActions}>
          <Pressable
            style={styles.workEditButton}
            onPress={() => router.push(`/trip-clip?videoId=${video.id}` as Href)}
          >
            <Text selectable={false} style={styles.workEditButtonText}>
              다시 편집
            </Text>
          </Pressable>
          <Pressable
            style={styles.workDeleteButton}
            onPress={() => onDelete(work)}
          >
            <Text selectable={false} style={styles.workDeleteButtonText}>
              삭제
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const bundle = work.item;

  return (
    <View style={styles.videoCard}>
      {bundle.coverUri ? (
        <Image source={{ uri: bundle.coverUri }} style={styles.videoThumb} contentFit="cover" />
      ) : (
        <View style={styles.videoThumbEmpty} />
      )}
      <Pressable
        style={({ pressed }) => [styles.videoCopy, pressed && styles.pressed]}
        onPress={() => router.push(`/trip-clip?bundleId=${bundle.id}` as Href)}
      >
        <Text selectable style={styles.videoKind}>
          영상 만들기 작업
        </Text>
        <Text selectable style={styles.videoTitle}>
          {bundle.title}
        </Text>
        <Text selectable style={styles.metaText}>
          {formatDate(bundle.createdAt)} / {bundle.ratio}
        </Text>
        <Text selectable style={styles.metaText}>
          이미지 {bundle.photoIds.length}장
        </Text>
      </Pressable>
    <View style={styles.workActions}>
      <Pressable
        style={styles.workEditButton}
        onPress={() => router.push(`/trip-clip?bundleId=${bundle.id}` as Href)}
      >
        <Text selectable={false} style={styles.workEditButtonText}>
          다시 편집
        </Text>
      </Pressable>
      <Pressable
        style={styles.workDeleteButton}
        onPress={() => onDelete(work)}
      >
        <Text selectable={false} style={styles.workDeleteButtonText}>
          삭제
        </Text>
      </Pressable>
    </View>
  </View>
);
}

function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.text} />
    </View>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.emptyState}>
      <Text selectable style={styles.emptyTitle}>
        {title}
      </Text>
      <Text selectable style={styles.emptyDetail}>
        {detail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tab: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  tabActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  tabText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  tabTextActive: {
    color: colors.inverse
  },
  pageSizeBar: {
    minHeight: controls.compactHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 2
  },
  pageSizeLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  pageSizeOptions: {
    flexDirection: "row",
    gap: 6
  },
  pageSizeButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  pageSizeButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  pageSizeButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  pageSizeButtonTextActive: {
    color: colors.inverse
  },
  clipCta: {
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  importImageCta: {
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  pressed: {
    backgroundColor: colors.surfaceStrong
  },
  disabledAction: {
    opacity: 0.45
  },
  clipCopy: {
    gap: 8
  },
  clipTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  clipDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  clipAction: {
    minHeight: 40,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.text
  },
  clipActionText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    lineHeight: 19,
    textAlign: "center",
    letterSpacing: 0
  },
  importProgressBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "rgba(0, 0, 0, 0.38)"
  },
  importProgressPanel: {
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  importProgressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  importProgressCopy: {
    flex: 1,
    gap: 6
  },
  importProgressTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
    letterSpacing: 0
  },
  importProgressDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  importProgressTrack: {
    height: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(0, 0, 0, 0.08)"
  },
  importProgressFill: {
    height: "100%",
    backgroundColor: colors.text
  },
  importProgressText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    textAlign: "right",
    letterSpacing: 0
  },
  loading: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center"
  },
  paginatedList: {
    gap: 12
  },
  backupUsageBadge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  backupUsageText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 4
  },
  photoCard: {
    width: "47.8%",
    gap: 10
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  photoMeta: {
    gap: 4
  },
  photoDate: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  metaText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  cardActions: {
    flexDirection: "row",
    gap: 6
  },
  cardButton: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  cardButtonText: {
    color: colors.inverse,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  cardLightButton: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  cardLightButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  cardDeleteButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  videoList: {
    gap: 10
  },
  paginationBar: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  paginationButton: {
    minHeight: 32,
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  paginationButtonDisabled: {
    opacity: 0.35
  },
  paginationButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  paginationMeta: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    textAlign: "center",
    letterSpacing: 0
  },
  videoCard: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  videoThumb: {
    width: 72,
    height: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  videoThumbEmpty: {
    width: 72,
    height: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink
  },
  videoCopy: {
    flex: 1,
    gap: 5
  },
  videoKind: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  videoTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  workActions: {
    width: 72,
    gap: 6
  },
  workEditButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  workEditButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  workDeleteButton: {
    minWidth: 42,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  workDeleteButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  emptyState: {
    minHeight: 72,
    gap: 6,
    paddingTop: 2,
    paddingBottom: 10
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  emptyDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  }
});
