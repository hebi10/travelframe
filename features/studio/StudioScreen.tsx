import * as ImagePicker from "expo-image-picker";
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  View
} from "react-native";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { colors } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import { getAppSettings } from "@/lib/app-settings";
import { useAuth } from "@/lib/auth-context";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { isMediaLibraryAccessGranted } from "@/lib/media-library-permissions";
import { requestMediaLibraryAccess } from "@/lib/request-media-library-access";
import { recordBackupFailure } from "@/lib/backup-failure-queue";
import {
  backupPhotoIfEnabled,
  subscribeCloudBackupOverview,
  type CloudBackupOverview
} from "@/lib/cloud-backup";
import {
  CLOUD_BACKUP_IMAGE_WORK_LIMIT,
  CLOUD_BACKUP_PHOTO_LIMIT,
  getCloudBackupVideoLimit
} from "@/lib/cloud-backup-limits";
import { deletePhoto, getPhotos, saveCapturedPhoto } from "@/lib/photo-library";
import { isCreatorSubscriptionActive } from "@/lib/subscription";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { deleteMadeVideo, getMadeVideos } from "@/lib/video-library";
import { deleteImageBundleWork, getImageBundleWorks } from "@/lib/work-library";
import type { PhotoItem } from "@/types/photo";
import type { MadeVideoItem } from "@/types/video";
import type { ImageBundleWorkItem } from "@/types/work";
import { EmptyState, LibraryErrorState, LoadingState, PageSizeSelector, PaginatedPhotoGrid, UsageBadge, WorkSection } from "@/features/studio/studio-screen.components";
import { initialBackupOverview, isSyncedPhoto, tabs, type DeleteProgress, type ImportProgress, type PageSize, type StudioTab, type StudioWorkItem } from "@/features/studio/studio-screen.model";
import { styles } from "@/features/studio/studio-screen.styles";

export default function StudioScreen() {
  const router = useRouter();
  const { palette } = useAppAppearance();
  const { user, subscription } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn: Boolean(user), subscription }),
    [subscription, user]
  );
  const canUseVideoCreation = planEntitlements.canExportVideo;
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<StudioTab>("photos");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videos, setVideos] = useState<MadeVideoItem[]>([]);
  const [imageBundles, setImageBundles] = useState<ImageBundleWorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportingImage, setIsImportingImage] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgress | null>(null);
  const [studioLoadErrorMessage, setStudioLoadErrorMessage] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(6);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(false);
  const [backupOverview, setBackupOverview] =
    useState<CloudBackupOverview>(initialBackupOverview);

  const showLoginRequiredForEditing = useCallback(() => {
    Alert.alert(
      "로그인이 필요합니다",
      "사진 편집은 무료 로그인부터 사용할 수 있습니다.",
      [
        { text: "닫기", style: "cancel" },
        { text: "로그인하기", onPress: () => router.push("/account" as Href) }
      ]
    );
  }, [router]);

  const showLoginRequiredForVideoCreation = useCallback(() => {
    Alert.alert(
      "로그인이 필요합니다",
      "동영상 만들기는 로그인 후 주 1회 무료로 사용할 수 있습니다.",
      [
        { text: "닫기", style: "cancel" },
        { text: "로그인하기", onPress: () => router.push("/account" as Href) }
      ]
    );
  }, [router]);

  const loadStudio = useCallback(async () => {
    try {
      setIsLoading(true);
      setStudioLoadErrorMessage(null);
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
    } catch (error) {
      setStudioLoadErrorMessage(
        getUserFacingErrorMessage(
          error,
          "보관함 데이터를 불러오지 못했습니다. 기기 저장 공간이나 권한 상태를 확인한 뒤 다시 시도해 주세요."
        )
      );
    } finally {
      setIsLoading(false);
    }
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

  const deletePhotoFromLibrary = async (photo: PhotoItem) => {
    setDeleteProgress({
      title: "사진 삭제 중",
      detail: isSyncedPhoto(photo)
        ? "동기화된 사진 기록을 정리하고 있습니다."
        : "사진을 삭제하고 있습니다."
    });

    try {
      await deletePhoto(photo.id);
      await loadStudio();
    } catch (error) {
      Alert.alert("삭제 실패", getUserFacingErrorMessage(error, "사진을 삭제하지 못했습니다."));
    } finally {
      setDeleteProgress(null);
    }
  };

  const confirmDeletePhoto = (photo: PhotoItem) => {
    Alert.alert("사진을 삭제할까요?", "앱에 저장된 사진이 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => deletePhotoFromLibrary(photo)
      }
    ]);
  };

  const deleteWorkFromLibrary = async (work: StudioWorkItem) => {
    setDeleteProgress({
      title: "작업물 삭제 중",
      detail: "작업물을 삭제하는 중입니다. 앱에 저장된 기록과 연결된 파일을 정리하고 있습니다."
    });

    try {
      if (work.kind === "video") {
        await deleteMadeVideo(work.item.id);
      } else if (work.kind === "image-bundle") {
        await deleteImageBundleWork(work.item.id);
      } else {
        await deletePhoto(work.item.id);
      }
      await loadStudio();
    } catch (error) {
      Alert.alert(
        "삭제 실패",
        getUserFacingErrorMessage(
          error,
          "작업물을 삭제하지 못했습니다. 저장 공간이나 권한 상태를 확인한 뒤 다시 시도해 주세요."
        )
      );
    } finally {
      setDeleteProgress(null);
    }
  };

  const confirmDeleteWork = (work: StudioWorkItem) => {
    Alert.alert("작업물을 삭제할까요?", "앱에 저장된 작업물 기록이 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => deleteWorkFromLibrary(work)
      }
    ]);
  };

  const importImageToApp = async () => {
    if (isImportingImage) {
      return;
    }

    try {
      setIsImportingImage(true);
      const mediaAccessState = await requestMediaLibraryAccess({
        fallbackMessage: "이미지를 앱에 저장하려면 앨범 접근 권한이 필요합니다."
      });
      if (!isMediaLibraryAccessGranted(mediaAccessState)) {
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

      let importSuccessCount = 0;
      let importFailureCount = 0;
      let backupFailureCount = 0;
      setImportProgress({
        percent: 0,
        detail: `선택한 이미지 ${importAssets.length}장을 저장할 준비를 하고 있습니다.`
      });

      for (const [index, asset] of importAssets.entries()) {
        let savedPhoto: PhotoItem;

        try {
          savedPhoto = await saveCapturedPhoto({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            localImageLimit: planEntitlements.localImageLimit
          });
          importSuccessCount += 1;
        } catch (importError) {
          importFailureCount += 1;
          console.error("가져온 사진을 저장하지 못했습니다.", importError);
          setImportProgress({
            percent: ((index + 1) / importAssets.length) * 100,
            detail: `일부 이미지를 저장하지 못했습니다. ${index + 1}/${importAssets.length}`
          });
          continue;
        }

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
      if (importSuccessCount > 0) {
        setActiveTab("photos");
      }

      const importSummary =
        importFailureCount > 0
          ? importSuccessCount > 0
            ? `선택한 이미지 ${importSuccessCount}장은 저장했습니다. ${importFailureCount}장은 기기 저장 공간이나 파일 접근 문제로 저장하지 못했습니다. 다시 가져오기 전에 저장 공간과 사진 권한을 확인해 주세요.${
                backupFailureCount > 0
                  ? " 일부 이미지는 클라우드 백업을 완료하지 못했습니다. 인터넷 연결이나 계정 상태를 확인한 뒤 설정에서 백업을 다시 시도해 주세요."
                  : ""
              }`
            : `선택한 이미지 ${importAssets.length}장을 저장하지 못했습니다. 기기 저장 공간이나 사진 권한을 확인한 뒤 다시 시도해 주세요.`
          : backupFailureCount > 0
            ? `선택한 이미지 ${importSuccessCount}장을 앱 사진 목록에 저장했습니다. 일부 이미지는 클라우드 백업을 완료하지 못했습니다. 인터넷 연결이나 계정 상태를 확인한 뒤 설정에서 백업을 다시 시도해 주세요.`
            : `선택한 이미지 ${importSuccessCount}장을 앱 사진 목록에 저장했습니다.`;
      Alert.alert(importSuccessCount > 0 ? "저장 완료" : "저장 실패", importSummary);
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

  const photoLibraryItems = photos;
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
  const savedVideoWorks = videoWorks;
  const workCount =
    singleImageWorks.length + imageBundleWorks.length + videoWorks.length;
  const videoWorkCount = imageBundleWorks.length + savedVideoWorks.length;
  const shouldShowBackupUsage =
    Boolean(user) && cloudBackupEnabled && isCreatorSubscriptionActive(subscription);
  const videoBackupLimit = getCloudBackupVideoLimit(planEntitlements.tier);
  const photoUsage = shouldShowBackupUsage
    ? { label: "클라우드 백업", count: backupOverview.photoCount, limit: CLOUD_BACKUP_PHOTO_LIMIT }
    : { label: "이미지 보관함", count: photoLibraryItems.length, limit: planEntitlements.localImageLimit };
  const imageBundleUsage = shouldShowBackupUsage
    ? {
        label: "클라우드 백업",
        count: backupOverview.imageBundleCount,
        limit: CLOUD_BACKUP_IMAGE_WORK_LIMIT
      }
    : { label: "이미지 보관함", count: imageBundles.length, limit: planEntitlements.localImageLimit };
  const videoUsage = shouldShowBackupUsage
    ? { label: "클라우드 백업", count: backupOverview.videoCount, limit: videoBackupLimit }
    : { label: "영상 보관함", count: videos.length, limit: planEntitlements.localVideoLimit };
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
  const pressedPanelStyle = {
    backgroundColor: palette.surfaceStrong
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

      {!isLoading && studioLoadErrorMessage ? (
        <SectionBlock title="보관함 상태">
          <LibraryErrorState message={studioLoadErrorMessage} onRetry={loadStudio} />
        </SectionBlock>
      ) : null}

      {activeTab === "photos" ? (
        <>
          <SectionBlock title="이미지 저장">
            <Pressable
              disabled={isImportingImage}
              style={({ pressed }) => [
                styles.importImageCta,
                panelStyle,
                pressed && pressedPanelStyle,
                isImportingImage && styles.disabledAction
              ]}
              onPress={importImageToApp}
            >
              <View style={styles.clipCopy}>
                <Text selectable={false} style={styles.clipTitle}>
                  앱에 이미지 저장
                </Text>
                <Text selectable={false} style={styles.clipDetail}>
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
          <UsageBadge label={photoUsage.label} count={photoUsage.count} limit={photoUsage.limit} />
          {isLoading ? (
            <LoadingState />
          ) : studioLoadErrorMessage ? null : photoLibraryItems.length > 0 ? (
            <PaginatedPhotoGrid
              items={photoLibraryItems}
              page={pages.photos ?? 0}
              pageSize={pageSize}
              router={router}
              canEditLibraryItems={Boolean(user)}
              onDeletePhoto={confirmDeletePhoto}
              onRequireLoginForEdit={showLoginRequiredForEditing}
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
              style={({ pressed }) => [styles.clipCta, panelStyle, pressed && pressedPanelStyle]}
              onPress={() => {
                if (!canUseVideoCreation) {
                  showLoginRequiredForVideoCreation();
                  return;
                }

                router.push({
                  pathname: "/trip-clip",
                  params: { returnTo: "/studio?tab=videos", start: "new" }
                } as Href);
              }}
            >
              <View style={styles.clipCopy}>
                <Text selectable={false} style={styles.clipTitle}>
                  영상 만들기
                </Text>
                <Text selectable={false} style={styles.clipDetail}>
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
          ) : studioLoadErrorMessage ? null : videoWorkCount > 0 ? (
            <>
              {imageBundleWorks.length > 0 ? (
                <WorkSection
                  title="영상 만들기 작업"
                  emptyDetail="영상 만들기에서 저장한 이미지 작업이 이곳에 표시됩니다."
                  items={imageBundleWorks}
                  page={pages.videoImageBundles ?? 0}
                  pageSize={pageSize}
                  router={router}
                  onDeleteWork={confirmDeleteWork}
                  canEditLibraryItems={Boolean(user)}
                  canUseVideoCreation={canUseVideoCreation}
                  onRequireLoginForEdit={showLoginRequiredForEditing}
                  onRequireLoginForVideo={showLoginRequiredForVideoCreation}
                  onPageChange={(page) => setSectionPage("videoImageBundles", page)}
                  usage={imageBundleUsage}
                />
              ) : null}
              {savedVideoWorks.length > 0 ? (
                <WorkSection
                  title="저장한 영상"
                  emptyDetail="여행 클립을 저장하면 이곳에 표시됩니다."
                  items={savedVideoWorks}
                  page={pages.videoWorks ?? 0}
                  pageSize={pageSize}
                  router={router}
                  onDeleteWork={confirmDeleteWork}
                  canEditLibraryItems={Boolean(user)}
                  canUseVideoCreation={canUseVideoCreation}
                  onRequireLoginForEdit={showLoginRequiredForEditing}
                  onRequireLoginForVideo={showLoginRequiredForVideoCreation}
                  onPageChange={(page) => setSectionPage("videoWorks", page)}
                  usage={videoUsage}
                />
              ) : null}
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
          ) : studioLoadErrorMessage ? null : workCount > 0 ? (
            <>
              {singleImageWorks.length > 0 ? (
                <WorkSection
                  title="단일 이미지"
                  emptyDetail="사진을 편집하면 이곳에 단일 이미지 작업물이 표시됩니다."
                  items={singleImageWorks}
                  page={pages.singleImages ?? 0}
                  pageSize={pageSize}
                  router={router}
                  onDeleteWork={confirmDeleteWork}
                  canEditLibraryItems={Boolean(user)}
                  canUseVideoCreation={canUseVideoCreation}
                  onRequireLoginForEdit={showLoginRequiredForEditing}
                  onRequireLoginForVideo={showLoginRequiredForVideoCreation}
                  onPageChange={(page) => setSectionPage("singleImages", page)}
                  usage={photoUsage}
                />
              ) : null}
              {imageBundleWorks.length > 0 ? (
                <WorkSection
                  title="영상 만들기 작업"
                  emptyDetail="영상 만들기에서 저장한 이미지 작업이 이곳에 표시됩니다."
                  items={imageBundleWorks}
                  page={pages.imageBundles ?? 0}
                  pageSize={pageSize}
                  router={router}
                  onDeleteWork={confirmDeleteWork}
                  canEditLibraryItems={Boolean(user)}
                  canUseVideoCreation={canUseVideoCreation}
                  onRequireLoginForEdit={showLoginRequiredForEditing}
                  onRequireLoginForVideo={showLoginRequiredForVideoCreation}
                  onPageChange={(page) => setSectionPage("imageBundles", page)}
                  usage={imageBundleUsage}
                />
              ) : null}
              {videoWorks.length > 0 ? (
                <WorkSection
                  title="영상"
                  emptyDetail="여행 클립을 저장하면 이곳에 표시됩니다."
                  items={videoWorks}
                  page={pages.videos ?? 0}
                  pageSize={pageSize}
                  router={router}
                  onDeleteWork={confirmDeleteWork}
                  canEditLibraryItems={Boolean(user)}
                  canUseVideoCreation={canUseVideoCreation}
                  onRequireLoginForEdit={showLoginRequiredForEditing}
                  onRequireLoginForVideo={showLoginRequiredForVideoCreation}
                  onPageChange={(page) => setSectionPage("videos", page)}
                  usage={videoUsage}
                />
              ) : null}
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
                    <Text selectable={false} style={styles.importProgressTitle}>
                      이미지 저장 중
                    </Text>
                    <Text selectable={false} style={styles.importProgressDetail}>
                      이미지를 앱에 저장하는 중입니다.
                    </Text>
                  </View>
                </View>
                <Text selectable={false} style={styles.importProgressDetail}>
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
                <Text selectable={false} style={styles.importProgressText}>
                  {Math.round(importProgress.percent)}%
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(deleteProgress)}
        onRequestClose={() => undefined}
      >
        <View style={styles.importProgressBackdrop}>
          <View style={[styles.importProgressPanel, panelStyle]}>
            {deleteProgress ? (
              <View style={styles.importProgressHeader}>
                <ActivityIndicator color={palette.text} />
                <View style={styles.importProgressCopy}>
                  <Text selectable={false} style={styles.importProgressTitle}>
                    {deleteProgress.title}
                  </Text>
                  <Text selectable={false} style={styles.importProgressDetail}>
                    {deleteProgress.detail}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenShell>
    <AppGuideOverlay tabKey="studio" />
    </>
  );
}
