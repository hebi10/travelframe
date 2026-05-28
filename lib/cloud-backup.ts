import { type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import {
  getAppSettings,
  isCloudBackupTargetEnabled,
  type AppSettings
} from "@/lib/app-settings";
import {
  IMAGE_BACKUP_SIZE_EXCEEDED_MESSAGE,
  IMAGE_OPTIMIZATION_FAILED_MESSAGE
} from "@/constants/image";
import {
  canBackupMoreVideos,
  getCloudBackupStorageLimitBytes,
  getCloudBackupVideoLimit,
  type CloudBackupLimitTier
} from "@/lib/cloud-backup-limits";
import { firebaseFunctions, firestore, firebaseStorage } from "@/lib/firebase";
import {
  calculateCombinedImageBackupSize,
  isImageBackupSizeExceeded,
  optimizeImageForBackup,
  type OptimizedBackupImage
} from "@/lib/image-backup-utils";
import { localStorageAdapter } from "@/lib/local-storage";
import { getPlanTier } from "@/lib/plan-entitlements";
import {
  getDeletedPhotoIds,
  getPhotos,
  markPhotoCloudOnly,
  replacePhotosFromBackup,
  wasPhotoDeletedLocally
} from "@/lib/photo-library";
import { isCreatorSubscriptionActive, type UserSubscription } from "@/lib/subscription";
import { isStorageSaverMode, shouldUseCloudBackupForStorageMode } from "@/lib/storage-mode";
import {
  getDeletedVideoIds,
  getMadeVideos,
  markMadeVideoCloudOnly,
  replaceMadeVideosFromBackup,
  wasVideoDeletedLocally
} from "@/lib/video-library";
import {
  getDeletedImageWorkIds,
  getImageBundleWorks,
  markImageBundleCloudOnly,
  replaceImageBundleWorksFromBackup,
  wasImageWorkDeletedLocally
} from "@/lib/work-library";
import type { PhotoItem } from "@/types/photo";
import type { MadeVideoItem } from "@/types/video";
import type { ImageBundleWorkItem } from "@/types/work";

export type BackupSummary = {
  photoCount: number;
  imageBundleCount: number;
  videoCount: number;
  imageBackupBytes: number;
  deleteAfter: string | null;
};

export type BackupProgressUpdate = {
  percent: number;
  detail: string;
};

export type CloudBackupOverview = BackupSummary & {
  status: string;
  backedUpAt: string | null;
  deletedAt: string | null;
};

export type LocalWorkspaceSummary = {
  photoCount: number;
  imageBundleCount: number;
  videoCount: number;
  totalCount: number;
};

const applyStorageSaverPolicy = async ({
  settings,
  photo,
  photoBackup,
  imageBundle,
  imageBundleBackup,
  video,
  videoBackup
}: {
  settings: AppSettings;
  photo?: PhotoItem;
  photoBackup?: Partial<PhotoItem> | null;
  imageBundle?: ImageBundleWorkItem;
  imageBundleBackup?: Partial<ImageBundleWorkItem> | null;
  video?: MadeVideoItem;
  videoBackup?: Partial<MadeVideoItem> | null;
}) => {
  if (!isStorageSaverMode(settings.storageMode, true)) {
    return;
  }

  if (photo) {
    await markPhotoCloudOnly(photo.id, photoBackup ?? null);
  }

  if (imageBundle) {
    await markImageBundleCloudOnly(imageBundle.id, imageBundleBackup ?? null);
  }

  if (video) {
    await markMadeVideoCloudOnly(video.id, videoBackup ?? null);
  }
};

const DEVICE_ID_STORAGE_KEY = "travel-frame.backup-device-id.v1";

const emitBackupProgress = (
  onProgress: ((progress: BackupProgressUpdate) => void) | undefined,
  percent: number,
  detail: string
) => {
  onProgress?.({
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    detail
  });
};

const fileNameFromUri = (uri: string, fallback: string) => {
  const cleanUri = uri.split("?")[0] ?? uri;
  const fileName = cleanUri.split("/").pop();
  return fileName && fileName.includes(".") ? fileName : fallback;
};

const getContentType = (uri: string) => {
  const lowerUri = uri.toLowerCase();
  if (lowerUri.endsWith(".png")) {
    return "image/png";
  }

  if (lowerUri.endsWith(".webp")) {
    return "image/webp";
  }

  if (lowerUri.endsWith(".mp4")) {
    return "video/mp4";
  }

  return "image/jpeg";
};

type BackupMediaKind = "image" | "video" | "audio";

type ReserveBackupUploadResponse = {
  backupSessionId: string;
  storagePath: string;
  expiresInSeconds: number;
};

type CompleteBackupUploadResponse = {
  usage: {
    imageTotalBytes: number;
    videoCount: number;
    audioTotalBytes: number;
  };
};

type UploadedBackupFile = {
  downloadURL: string;
  fileSize: number;
  backupSessionId: string;
  storagePath: string;
};

const callBackupFunction = async <Request, Response>(
  name: string,
  data: Request
): Promise<Response> => {
  if (!firebaseFunctions) {
    throw new Error("클라우드 백업을 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }

  const callable = httpsCallable<Request, Response>(firebaseFunctions, name);
  try {
    const result = await callable(data);
    return result.data;
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    const message = error instanceof Error ? error.message : String(error);

    if (
      code.includes("not-found") ||
      message.includes("not-found") ||
      message.includes("NOT_FOUND")
    ) {
      throw new Error("클라우드 백업을 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }

    if (
      code.includes("permission-denied") ||
      message.includes("Active backup subscription")
    ) {
      throw new Error(
        "구독이 활성화된 계정만 백업할 수 있습니다. 관리자 페이지에서 구독 상태를 확인해 주세요."
      );
    }

    throw error;
  }
};

const reserveBackupUpload = (data: {
  mediaKind: BackupMediaKind;
  fileSize: number;
  contentType: string;
  storagePath: string;
}) =>
  callBackupFunction<typeof data, ReserveBackupUploadResponse>(
    "reserveBackupUpload",
    data
  );

const completeBackupUpload = (data: { backupSessionId: string }) =>
  callBackupFunction<typeof data, CompleteBackupUploadResponse>(
    "completeBackupUpload",
    data
  );

const releaseBackupUpload = (data: { backupSessionId: string }) =>
  callBackupFunction<typeof data, { released: boolean }>("releaseBackupUpload", data);

const deleteCloudBackupDataCallable = () =>
  callBackupFunction<Record<string, never>, BackupSummary>(
    "deleteCloudBackupData",
    {}
  );

const normalizeDateValue = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return null;
};

const getSourceDeviceId = async () => {
  const storedDeviceId = await localStorageAdapter.getItem(DEVICE_ID_STORAGE_KEY);
  if (storedDeviceId) {
    return storedDeviceId;
  }

  const nextDeviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await localStorageAdapter.setItem(DEVICE_ID_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
};

const getBackupLimitTier = (
  subscription?: UserSubscription | null
): CloudBackupLimitTier =>
  getPlanTier({ isLoggedIn: Boolean(subscription), subscription: subscription ?? null });

const uploadLocalFile = async ({
  uri,
  storagePath,
  mediaKind
}: {
  uri: string;
  storagePath: string;
  mediaKind: BackupMediaKind;
}): Promise<UploadedBackupFile> => {
  if (!firebaseStorage) {
    throw new Error("클라우드 백업을 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const contentType = getContentType(uri);
  const reservation = await reserveBackupUpload({
    mediaKind,
    fileSize: blob.size,
    contentType,
    storagePath
  });
  const uploadStoragePath = reservation.storagePath;
  const fileRef = ref(firebaseStorage, uploadStoragePath);

  try {
    await uploadBytes(fileRef, blob, {
      contentType,
      customMetadata: {
        backupSessionId: reservation.backupSessionId
      }
    });
    await completeBackupUpload({
      backupSessionId: reservation.backupSessionId
    });

    return {
      downloadURL: await getDownloadURL(fileRef),
      fileSize: blob.size,
      backupSessionId: reservation.backupSessionId,
      storagePath: uploadStoragePath
    };
  } catch (error) {
    await releaseBackupUpload({
      backupSessionId: reservation.backupSessionId
    }).catch(() => undefined);
    throw error;
  }
};

const emptyBackupOverview: CloudBackupOverview = {
  photoCount: 0,
  imageBundleCount: 0,
  videoCount: 0,
  imageBackupBytes: 0,
  deleteAfter: null,
  status: "none",
  backedUpAt: null,
  deletedAt: null
};

const getCollectionSize = async (userId: string, collectionName: string) => {
  if (!firestore) {
    return 0;
  }

  const snapshot = await getDocs(collection(firestore, "users", userId, collectionName));
  return snapshot.size;
};

export const getLocalWorkspaceSummary = async (): Promise<LocalWorkspaceSummary> => {
  const [photos, imageBundles, videos] = await Promise.all([
    getPhotos(),
    getImageBundleWorks(),
    getMadeVideos()
  ]);

  return {
    photoCount: photos.length,
    imageBundleCount: imageBundles.length,
    videoCount: videos.length,
    totalCount: photos.length + imageBundles.length + videos.length
  };
};

const getDocImageBackupSize = (data: Record<string, unknown>) => {
  const directSize = data.imageBackupSize ?? data.optimizedSize ?? data.size;
  if (typeof directSize === "number") {
    return directSize;
  }

  if (Array.isArray(data.optimizedImages)) {
    return data.optimizedImages.reduce((sum, image) => {
      if (image && typeof image === "object" && "size" in image) {
        const size = (image as { size?: unknown }).size;
        return sum + (typeof size === "number" ? size : 0);
      }

      return sum;
    }, 0);
  }

  return 0;
};

const getCurrentImageBackupSize = async ({
  userId,
  excludePhotoIds = [],
  excludeImageWorkIds = []
}: {
  userId: string;
  excludePhotoIds?: string[];
  excludeImageWorkIds?: string[];
}) => {
  if (!firestore) {
    return 0;
  }

  const excludePhotoSet = new Set(excludePhotoIds);
  const excludeImageWorkSet = new Set(excludeImageWorkIds);
  const [photoSnapshot, imageWorkSnapshot] = await Promise.all([
    getDocs(collection(firestore, "users", userId, "photoBackups")),
    getDocs(collection(firestore, "users", userId, "imageWorks"))
  ]);

  const photoBytes = photoSnapshot.docs.reduce((sum, item) => {
    if (excludePhotoSet.has(item.id)) {
      return sum;
    }

    return sum + getDocImageBackupSize(item.data());
  }, 0);
  const imageWorkBytes = imageWorkSnapshot.docs.reduce((sum, item) => {
    if (excludeImageWorkSet.has(item.id)) {
      return sum;
    }

    return sum + getDocImageBackupSize(item.data());
  }, 0);

  return photoBytes + imageWorkBytes;
};

const assertImageBackupCapacity = async ({
  userId,
  newImages,
  excludePhotoIds,
  excludeImageWorkIds,
  tier = "pro"
}: {
  userId: string;
  newImages: OptimizedBackupImage[];
  excludePhotoIds?: string[];
  excludeImageWorkIds?: string[];
  tier?: CloudBackupLimitTier;
}) => {
  const currentSize = await getCurrentImageBackupSize({
    userId,
    excludePhotoIds,
    excludeImageWorkIds
  });
  const totalSize = calculateCombinedImageBackupSize(
    currentSize,
    newImages.map((image) => image.size)
  );

  if (isImageBackupSizeExceeded(totalSize, getCloudBackupStorageLimitBytes(tier))) {
    throw new Error(IMAGE_BACKUP_SIZE_EXCEEDED_MESSAGE);
  }

  return totalSize;
};

const refreshBackupOverview = async (userId: string, backedUpAt?: string) => {
  if (!firestore) {
    return emptyBackupOverview;
  }

  const [photoCount, imageBundleCount, videoCount, imageBackupBytes] = await Promise.all([
    getCollectionSize(userId, "photoBackups"),
    getCollectionSize(userId, "imageWorks"),
    getCollectionSize(userId, "videos"),
    getCurrentImageBackupSize({ userId })
  ]);

  const overview: CloudBackupOverview = {
    ...emptyBackupOverview,
    photoCount,
    imageBundleCount,
    videoCount,
    imageBackupBytes,
    status: photoCount + imageBundleCount + videoCount > 0 ? "active" : "none"
  };

  await setDoc(
    doc(firestore, "users", userId, "backups", "current"),
    {
      userId,
      photoCount,
      imageBundleCount,
      videoCount,
      imageBackupBytes,
      status: overview.status,
      ...(backedUpAt ? { backedUpAt } : {}),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return overview;
};

const isPhotoStillBackupEligible = async (photoId: string) => {
  if (await wasPhotoDeletedLocally(photoId)) {
    return false;
  }

  const photos = await getPhotos();
  return photos.some((photo) => photo.id === photoId);
};

const removeBackupIfPhotoWasDeleted = async ({
  user,
  photo,
  backupSessionId
}: {
  user: User;
  photo: PhotoItem;
  backupSessionId?: string | null;
}) => {
  if (!(await wasPhotoDeletedLocally(photo.id))) {
    return false;
  }

  if (!firestore) {
    return false;
  }

  await deleteDoc(doc(firestore, "users", user.uid, "photoBackups", photo.id));
  if (backupSessionId) {
    await releaseBackupUpload({ backupSessionId });
  }
  await refreshBackupOverview(user.uid);
  return true;
};

const releaseBackupUploads = async (backupSessionIds: string[]) => {
  await Promise.all(
    [...new Set(backupSessionIds)]
      .filter((backupSessionId) => backupSessionId.length > 0)
      .map((backupSessionId) =>
        releaseBackupUpload({ backupSessionId }).catch(() => undefined)
      )
  );
};

const isImageWorkStillBackupEligible = async (workId: string) => {
  if (await wasImageWorkDeletedLocally(workId)) {
    return false;
  }

  const works = await getImageBundleWorks();
  return works.some((work) => work.id === workId);
};

const isVideoStillBackupEligible = async (videoId: string) => {
  if (await wasVideoDeletedLocally(videoId)) {
    return false;
  }

  const videos = await getMadeVideos();
  return videos.some((video) => video.id === videoId);
};

const removeBackupIfImageWorkWasDeleted = async ({
  user,
  work,
  backupSessionIds
}: {
  user: User;
  work: ImageBundleWorkItem;
  backupSessionIds: string[];
}) => {
  if (!(await wasImageWorkDeletedLocally(work.id))) {
    return false;
  }

  if (!firestore) {
    return false;
  }

  await deleteDoc(doc(firestore, "users", user.uid, "imageWorks", work.id));
  await releaseBackupUploads(backupSessionIds);
  await refreshBackupOverview(user.uid);
  return true;
};

const removeBackupIfVideoWasDeleted = async ({
  user,
  video,
  backupSessionId
}: {
  user: User;
  video: MadeVideoItem;
  backupSessionId?: string | null;
}) => {
  if (!(await wasVideoDeletedLocally(video.id))) {
    return false;
  }

  if (!firestore) {
    return false;
  }

  await deleteDoc(doc(firestore, "users", user.uid, "videos", video.id));
  if (backupSessionId) {
    await releaseBackupUploads([backupSessionId]);
  }
  await refreshBackupOverview(user.uid);
  return true;
};

export const subscribeCloudBackupOverview = ({
  user,
  onChange
}: {
  user: User | null;
  onChange: (overview: CloudBackupOverview) => void;
}) => {
  if (!user || !firestore) {
    onChange(emptyBackupOverview);
    return () => undefined;
  }

  return onSnapshot(doc(firestore, "users", user.uid, "backups", "current"), (snapshot) => {
    const data = snapshot.data() as Partial<CloudBackupOverview> | undefined;
    onChange({
      ...emptyBackupOverview,
      ...data,
      status: data?.status ?? (snapshot.exists() ? "active" : "none"),
      photoCount: data?.photoCount ?? 0,
      imageBundleCount: data?.imageBundleCount ?? 0,
      videoCount: data?.videoCount ?? 0,
      imageBackupBytes: data?.imageBackupBytes ?? 0,
      deleteAfter: data?.deleteAfter ?? null,
      backedUpAt: data?.backedUpAt ?? null,
      deletedAt: data?.deletedAt ?? null
    });
  });
};

export const getCloudBackupOverview = async ({
  user
}: {
  user: User | null;
}): Promise<CloudBackupOverview> => {
  if (!user || !firestore) {
    return emptyBackupOverview;
  }

  const [overviewSnapshot, photoCount, imageBundleCount, videoCount, imageBackupBytes] =
    await Promise.all([
      getDoc(doc(firestore, "users", user.uid, "backups", "current")),
      getCollectionSize(user.uid, "photoBackups"),
      getCollectionSize(user.uid, "imageWorks"),
      getCollectionSize(user.uid, "videos"),
      getCurrentImageBackupSize({ userId: user.uid })
    ]);
  const data = overviewSnapshot.data() as Partial<CloudBackupOverview> | undefined;
  const hasBackupData = photoCount + imageBundleCount + videoCount > 0;

  return {
    ...emptyBackupOverview,
    ...data,
    status: data?.status ?? (hasBackupData ? "active" : "none"),
    photoCount,
    imageBundleCount,
    videoCount,
    imageBackupBytes,
    deleteAfter: data?.deleteAfter ?? null,
    backedUpAt: normalizeDateValue(data?.backedUpAt),
    deletedAt: normalizeDateValue(data?.deletedAt)
  };
};

export const ensureBackupAvailable = (subscription: UserSubscription) => {
  if (isCreatorSubscriptionActive(subscription)) {
    return;
  }

  throw new Error(
    "구독 기간이 만료되어 백업을 사용할 수 없습니다. 기존 백업 데이터 삭제는 설정에서 직접 요청할 수 있습니다."
  );
};

export const backupCurrentWorkspace = async ({
  user,
  subscription,
  onProgress
}: {
  user: User | null;
  subscription: UserSubscription;
  onProgress?: (progress: BackupProgressUpdate) => void;
}): Promise<BackupSummary> => {
  if (!user) {
    throw new Error("로그인 후 백업할 수 있습니다.");
  }

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  ensureBackupAvailable(subscription);
  const backupLimitTier = getBackupLimitTier(subscription);
  emitBackupProgress(onProgress, 3, "백업할 데이터를 준비하고 있습니다.");

  const [settings, photos, imageBundles, videos] = await Promise.all([
    getAppSettings(),
    getPhotos(),
    getImageBundleWorks(),
    getMadeVideos()
  ]);
  const selectedPhotoBackups = isCloudBackupTargetEnabled(settings, "photos")
    ? photos
    : [];
  const selectedImageBundleBackups = isCloudBackupTargetEnabled(settings, "imageBundles")
    ? imageBundles
    : [];
  const selectedVideoBackups = isCloudBackupTargetEnabled(settings, "videos")
    ? videos
    : [];
  const backupablePhotoBackups: PhotoItem[] = [];
  for (const photo of selectedPhotoBackups) {
    if (photo.localFileStatus === "cloud_only") {
      continue;
    }
    if (!(await isPhotoStillBackupEligible(photo.id))) {
      continue;
    }
    backupablePhotoBackups.push(photo);
  }
  const backupableImageBundleBackups: ImageBundleWorkItem[] = [];
  for (const work of selectedImageBundleBackups) {
    if (work.localFileStatus === "cloud_only") {
      continue;
    }
    if (!(await isImageWorkStillBackupEligible(work.id))) {
      continue;
    }
    backupableImageBundleBackups.push(work);
  }
  const backupableVideoBackups: MadeVideoItem[] = [];
  for (const video of selectedVideoBackups) {
    if (video.localFileStatus === "cloud_only") {
      continue;
    }
    if (!(await isVideoStillBackupEligible(video.id))) {
      continue;
    }
    backupableVideoBackups.push(video);
  }
  emitBackupProgress(onProgress, 8, "백업할 데이터를 확인하고 있습니다.");
  const backedUpAt = new Date().toISOString();
  const sourceDeviceId = await getSourceDeviceId();
  const totalOptimizeItems =
    backupablePhotoBackups.length +
    backupableImageBundleBackups.reduce((sum, work) => sum + work.imageUris.length, 0);
  let optimizedItemCount = 0;
  const updateOptimizationProgress = () => {
    optimizedItemCount += 1;
    emitBackupProgress(
      onProgress,
      10 + (optimizedItemCount / Math.max(1, totalOptimizeItems)) * 35,
      "이미지를 최적화하고 있습니다."
    );
  };
  const optimizedPhotos = (await Promise.all(
    backupablePhotoBackups.map(async (photo) => {
      if (!(await isPhotoStillBackupEligible(photo.id))) {
        return null;
      }

      const optimized = await optimizeImageForBackup({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        sourceImageQuality: photo.imageQuality ?? null,
        imageQuality: settings.imageBackupQuality
      });
      updateOptimizationProgress();
      return { photo, optimized };
    })
  ).catch(() => {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  })).filter((item): item is { photo: PhotoItem; optimized: OptimizedBackupImage } =>
    Boolean(item)
  );
  const optimizedImageBundles = (await Promise.all(
    backupableImageBundleBackups.map(async (work) => {
      if (!(await isImageWorkStillBackupEligible(work.id))) {
        return null;
      }

      const images = await Promise.all(
        work.imageUris.map(async (imageUri, index) => {
          if (!(await isImageWorkStillBackupEligible(work.id))) {
            return null;
          }

          const optimized = await optimizeImageForBackup({
            uri: imageUri,
            width: work.imageWidths?.[index] ?? null,
            height: work.imageHeights?.[index] ?? null,
            sourceImageQuality: work.imageQuality ?? null,
            imageQuality: settings.imageBackupQuality
          });
          updateOptimizationProgress();
          return optimized;
        })
      );

      if (images.some((image) => !image)) {
        return null;
      }

      return { work, images: images as OptimizedBackupImage[] };
    })
  ).catch(() => {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  })).filter((item): item is { work: ImageBundleWorkItem; images: OptimizedBackupImage[] } =>
    Boolean(item)
  );
  if (totalOptimizeItems === 0) {
    emitBackupProgress(onProgress, 45, "백업할 이미지가 있는지 확인하고 있습니다.");
  }
  const allOptimizedImages = [
    ...optimizedPhotos.map((item) => item.optimized),
    ...optimizedImageBundles.flatMap((item) => item.images)
  ];
  const imageBackupBytes = await assertImageBackupCapacity({
    userId: user.uid,
    newImages: allOptimizedImages,
    excludePhotoIds: optimizedPhotos.map(({ photo }) => photo.id),
    excludeImageWorkIds: optimizedImageBundles.map(({ work }) => work.id),
    tier: backupLimitTier
  });
  emitBackupProgress(onProgress, 50, "백업 용량을 확인했습니다.");

  const totalUploadItems =
    backupablePhotoBackups.length +
    optimizedImageBundles.reduce((sum, item) => sum + item.images.length, 0) +
    backupableVideoBackups.length;
  let uploadedItemCount = 0;
  const updateUploadProgress = () => {
    uploadedItemCount += 1;
    emitBackupProgress(
      onProgress,
      52 + (uploadedItemCount / Math.max(1, totalUploadItems)) * 40,
      "Firebase에 백업하고 있습니다."
    );
  };

  for (const { photo, optimized } of optimizedPhotos) {
    if (!(await isPhotoStillBackupEligible(photo.id))) {
      continue;
    }

    const photoFileName = fileNameFromUri(photo.uri, `${photo.id}.jpg`);
    const photoPath = `users/${user.uid}/backups/photos/${photo.id}-${photoFileName}.jpg`;
    const photoUpload = await uploadLocalFile({
      uri: optimized.uri,
      storagePath: photoPath,
      mediaKind: "image"
    });
    const photoDownloadUrl = photoUpload.downloadURL;

    if (!(await isPhotoStillBackupEligible(photo.id))) {
      await releaseBackupUpload({
        backupSessionId: photoUpload.backupSessionId
      });
      continue;
    }

    await setDoc(doc(firestore, "users", user.uid, "photoBackups", photo.id), {
      ...photo,
      userId: user.uid,
      localId: photo.id,
      uri: photoDownloadUrl,
      localUri: photo.uri,
      storagePath: photoUpload.storagePath,
      downloadURL: photoDownloadUrl,
      previewUri: photoDownloadUrl,
      localPreviewUri: photo.previewUri ?? null,
      previewStoragePath: null,
      optimizedWidth: optimized.width,
      optimizedHeight: optimized.height,
      optimizedSize: optimized.size,
      imageBackupSize: optimized.size,
      optimizedQuality: optimized.quality,
      imageQuality: optimized.imageQuality,
      originalSize: optimized.originalSize,
      fileSize: photoUpload.fileSize,
      fileType: "image/jpeg",
      backupSessionId: photoUpload.backupSessionId,
      backupStatus: "backed_up",
      backupEnabledAt: backedUpAt,
      lastBackedUpAt: backedUpAt,
      sourceDeviceId,
      backedUpAt,
      updatedAt: serverTimestamp()
    });
    if (
      await removeBackupIfPhotoWasDeleted({
        user,
        photo,
        backupSessionId: photoUpload.backupSessionId
      })
    ) {
      continue;
    }

    await applyStorageSaverPolicy({
      settings,
      photo,
      photoBackup: {
        downloadURL: photoDownloadUrl,
        storagePath: photoUpload.storagePath,
        previewUri: photo.previewUri,
        backupStatus: "backed_up"
      }
    });
    updateUploadProgress();
  }

  for (const { work, images } of optimizedImageBundles) {
    if (!(await isImageWorkStillBackupEligible(work.id))) {
      continue;
    }

    const backedUpImageUris: string[] = [];
    const storagePaths: string[] = [];
    const backupSessionIds: string[] = [];
    let uploadedFileSize = 0;
    let cancelled = false;
    for (const [index, optimized] of images.entries()) {
      if (!(await isImageWorkStillBackupEligible(work.id))) {
        cancelled = true;
        break;
      }

      const fileName = fileNameFromUri(work.imageUris[index], `${work.id}-${index}.jpg`);
      const storagePath = `users/${user.uid}/backups/image-works/${work.id}/${index}-${fileName}.jpg`;
      const upload = await uploadLocalFile({
        uri: optimized.uri,
        storagePath,
        mediaKind: "image"
      });
      storagePaths.push(upload.storagePath);
      backupSessionIds.push(upload.backupSessionId);
      uploadedFileSize += upload.fileSize;
      backedUpImageUris.push(upload.downloadURL);
      if (!(await isImageWorkStillBackupEligible(work.id))) {
        cancelled = true;
        break;
      }
      updateUploadProgress();
    }

    if (cancelled || !(await isImageWorkStillBackupEligible(work.id))) {
      await releaseBackupUploads(backupSessionIds);
      continue;
    }

    await setDoc(
      doc(firestore, "users", user.uid, "imageWorks", work.id),
      {
        ...work,
        localImageUris: work.imageUris,
        imageUris: backedUpImageUris,
        storagePaths,
        backupSessionIds,
        optimizedImages: images,
        imageBackupSize: images.reduce((sum, image) => sum + image.size, 0),
        fileSize: uploadedFileSize,
        originalBackupSize: images.reduce((sum, image) => sum + image.originalSize, 0),
        imageQuality: settings.imageBackupQuality,
        userId: user.uid,
        localId: work.id,
        backupStatus: "backed_up",
        backupEnabledAt: backedUpAt,
        lastBackedUpAt: backedUpAt,
        sourceDeviceId,
        backedUpAt,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    if (
      await removeBackupIfImageWorkWasDeleted({
        user,
        work,
        backupSessionIds
      })
    ) {
      continue;
    }
    await applyStorageSaverPolicy({
      settings,
      imageBundle: work,
      imageBundleBackup: {
        imageUris: backedUpImageUris,
        storagePath: storagePaths[0],
        backupStatus: "backed_up"
      }
    });
  }

  for (const video of backupableVideoBackups) {
    if (!(await isVideoStillBackupEligible(video.id))) {
      continue;
    }

    const videoSnapshot = await getDoc(
      doc(firestore, "users", user.uid, "videos", video.id)
    );
    const existingVideo = videoSnapshot.data() as
      | {
          backupStatus?: string;
          localId?: string;
          storagePath?: string;
        }
      | undefined;

    if (
      videoSnapshot.exists() &&
      existingVideo?.backupStatus === "backed_up" &&
      existingVideo?.localId === video.id &&
      existingVideo?.storagePath
    ) {
      updateUploadProgress();
      continue;
    }

    const fileName = fileNameFromUri(video.uri, `${video.id}.mp4`);
    const storagePath = `users/${user.uid}/backups/videos/${video.id}-${fileName}`;
    const upload = await uploadLocalFile({
      uri: video.uri,
      storagePath,
      mediaKind: "video"
    });
    const downloadUrl = upload.downloadURL;

    if (!(await isVideoStillBackupEligible(video.id))) {
      await releaseBackupUploads([upload.backupSessionId]);
      continue;
    }

    await setDoc(
      doc(firestore, "users", user.uid, "videos", video.id),
      {
        ...video,
        userId: user.uid,
        localId: video.id,
        localUri: video.uri,
        uri: downloadUrl,
        storagePath: upload.storagePath,
        fileSize: upload.fileSize,
        backupSessionId: upload.backupSessionId,
        backupStatus: "backed_up",
        backupEnabledAt: backedUpAt,
        lastBackedUpAt: backedUpAt,
        sourceDeviceId,
        fileType: "video/mp4",
        backedUpAt,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    if (
      await removeBackupIfVideoWasDeleted({
        user,
        video,
        backupSessionId: upload.backupSessionId
      })
    ) {
      continue;
    }
    await applyStorageSaverPolicy({
      settings,
      video,
      videoBackup: {
        downloadURL: downloadUrl,
        uri: downloadUrl,
        storagePath: upload.storagePath,
        backupStatus: "backed_up"
      }
    });
    updateUploadProgress();
  }

  if (totalUploadItems === 0) {
    emitBackupProgress(onProgress, 92, "Firebase에 백업할 파일을 확인했습니다.");
  }

  emitBackupProgress(onProgress, 96, "백업을 마무리하고 있습니다.");
  const overview = await refreshBackupOverview(user.uid, backedUpAt);
  await setDoc(
    doc(firestore, "users", user.uid, "backups", "current"),
    {
      userId: user.uid,
      settings,
      imageBundles,
      videos,
      deleteAfter: null,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  emitBackupProgress(onProgress, 100, "백업을 완료했습니다.");

  return {
    photoCount: overview.photoCount,
    imageBundleCount: overview.imageBundleCount,
    videoCount: overview.videoCount,
    imageBackupBytes: overview.imageBackupBytes,
    deleteAfter: null
  };
};

export const backupPhoto = async ({
  user,
  photo,
  enabled,
  subscription,
  backupEnabledAt
}: {
  user: User | null;
  photo: PhotoItem;
  enabled: boolean;
  subscription?: UserSubscription | null;
  backupEnabledAt?: string | null;
}) => {
  if (!enabled || !user) {
    return null;
  }

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  if (!(await isPhotoStillBackupEligible(photo.id))) {
    await removeBackupIfPhotoWasDeleted({ user, photo });
    return null;
  }

  const existingSnapshot = await getDoc(
    doc(firestore, "users", user.uid, "photoBackups", photo.id)
  );
  const existingData = existingSnapshot.data() as
    | { localId?: string; storagePath?: string; backupStatus?: string }
    | undefined;

  if (
    existingSnapshot.exists() &&
    existingData?.localId === photo.id &&
    existingData.storagePath &&
    existingData.backupStatus === "backed_up"
  ) {
    return existingData;
  }

  if (photo.localFileStatus === "cloud_only") {
    return null;
  }

  const [settings, sourceDeviceId] = await Promise.all([
    getAppSettings(),
    getSourceDeviceId()
  ]);
  const backedUpAt = new Date().toISOString();
  const optimized = await optimizeImageForBackup({
    uri: photo.uri,
    width: photo.width,
    height: photo.height,
    sourceImageQuality: photo.imageQuality ?? null,
    imageQuality: settings.imageBackupQuality
  }).catch(() => {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  });

  await assertImageBackupCapacity({
    userId: user.uid,
    newImages: [optimized],
    excludePhotoIds: [photo.id],
    tier: getBackupLimitTier(subscription)
  });

  const photoFileName = fileNameFromUri(photo.uri, `${photo.id}.jpg`);
  const storagePath = `users/${user.uid}/backups/photos/${photo.id}-${photoFileName}.jpg`;
  const upload = await uploadLocalFile({
    uri: optimized.uri,
    storagePath,
    mediaKind: "image"
  });

  if (!(await isPhotoStillBackupEligible(photo.id))) {
    await releaseBackupUpload({
      backupSessionId: upload.backupSessionId
    });
    return null;
  }

  const downloadURL = upload.downloadURL;

  await setDoc(
    doc(firestore, "users", user.uid, "photoBackups", photo.id),
    {
      ...photo,
      userId: user.uid,
      localId: photo.id,
      uri: downloadURL,
      localUri: photo.uri,
      storagePath: upload.storagePath,
      downloadURL,
      previewUri: downloadURL,
      localPreviewUri: photo.previewUri ?? null,
      optimizedWidth: optimized.width,
      optimizedHeight: optimized.height,
      optimizedSize: optimized.size,
      imageBackupSize: optimized.size,
      optimizedQuality: optimized.quality,
      imageQuality: optimized.imageQuality,
      originalSize: optimized.originalSize,
      fileSize: upload.fileSize,
      fileType: "image/jpeg",
      backupSessionId: upload.backupSessionId,
      backupStatus: "backed_up",
      backupEnabledAt: backupEnabledAt ?? backedUpAt,
      lastBackedUpAt: backedUpAt,
      sourceDeviceId,
      backedUpAt,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  if (
    await removeBackupIfPhotoWasDeleted({
      user,
      photo,
      backupSessionId: upload.backupSessionId
    })
  ) {
    return null;
  }

  await refreshBackupOverview(user.uid, backedUpAt);
  await applyStorageSaverPolicy({
    settings,
    photo,
    photoBackup: {
      downloadURL,
      uri: downloadURL,
      storagePath: upload.storagePath,
      previewUri: photo.previewUri,
      backupStatus: "backed_up"
    }
  });

  return {
    ...photo,
    uri: downloadURL,
    previewUri: downloadURL,
    storagePath: upload.storagePath,
    downloadURL,
    backupStatus: "backed_up" as const
  };
};

export const backupPhotoIfEnabled = async ({
  user,
  subscription,
  photo
}: {
  user: User | null;
  subscription: UserSubscription;
  photo: PhotoItem;
}) => {
  const settings = await getAppSettings();
  if (
    !shouldUseCloudBackupForStorageMode(
      settings.storageMode,
      isCreatorSubscriptionActive(subscription)
    ) ||
    !isCloudBackupTargetEnabled(settings, "photos")
  ) {
    return null;
  }

  return backupPhoto({
    user,
    photo,
    subscription,
    enabled: shouldUseCloudBackupForStorageMode(
      settings.storageMode,
      isCreatorSubscriptionActive(subscription)
    )
  });
};

export const backupImageBundleWork = async ({
  user,
  work,
  enabled,
  subscription
}: {
  user: User | null;
  work: ImageBundleWorkItem;
  enabled: boolean;
  subscription?: UserSubscription | null;
}) => {
  if (!enabled || !user) {
    return null;
  }

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const settings = await getAppSettings();
  if (!isCloudBackupTargetEnabled(settings, "imageBundles")) {
    return null;
  }

  if (!(await isImageWorkStillBackupEligible(work.id))) {
    await removeBackupIfImageWorkWasDeleted({
      user,
      work,
      backupSessionIds: []
    });
    return null;
  }

  if (work.localFileStatus === "cloud_only") {
    return null;
  }

  const sourceDeviceId = await getSourceDeviceId();
  const backedUpAt = new Date().toISOString();
  const optimizedImages = await Promise.all(
    work.imageUris.map(async (imageUri, index) => {
      if (!(await isImageWorkStillBackupEligible(work.id))) {
        return null;
      }

      return optimizeImageForBackup({
        uri: imageUri,
        width: work.imageWidths?.[index] ?? null,
        height: work.imageHeights?.[index] ?? null,
        sourceImageQuality: work.imageQuality ?? null,
        imageQuality: settings.imageBackupQuality
      });
    })
  ).catch(() => {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  });
  if (optimizedImages.some((image) => !image)) {
    return null;
  }
  const safeOptimizedImages = optimizedImages as OptimizedBackupImage[];
  await assertImageBackupCapacity({
    userId: user.uid,
    newImages: safeOptimizedImages,
    excludeImageWorkIds: [work.id],
    tier: getBackupLimitTier(subscription)
  });

  const backedUpImageUris: string[] = [];
  const storagePaths: string[] = [];
  const backupSessionIds: string[] = [];
  let uploadedFileSize = 0;
  for (const [index, imageUri] of work.imageUris.entries()) {
    if (!(await isImageWorkStillBackupEligible(work.id))) {
      await releaseBackupUploads(backupSessionIds);
      return null;
    }

    const fileName = fileNameFromUri(imageUri, `${work.id}-${index}.jpg`);
    const storagePath = `users/${user.uid}/backups/image-works/${work.id}/${index}-${fileName}.jpg`;
    const upload = await uploadLocalFile({
      uri: safeOptimizedImages[index].uri,
      storagePath,
      mediaKind: "image"
    });
    storagePaths.push(upload.storagePath);
    backupSessionIds.push(upload.backupSessionId);
    uploadedFileSize += upload.fileSize;
    backedUpImageUris.push(upload.downloadURL);
    if (!(await isImageWorkStillBackupEligible(work.id))) {
      await releaseBackupUploads(backupSessionIds);
      return null;
    }
  }

  if (!(await isImageWorkStillBackupEligible(work.id))) {
    await releaseBackupUploads(backupSessionIds);
    return null;
  }

  await setDoc(
    doc(firestore, "users", user.uid, "imageWorks", work.id),
    {
      ...work,
      localImageUris: work.imageUris,
      imageUris: backedUpImageUris,
      storagePaths,
      backupSessionIds,
      optimizedImages: safeOptimizedImages,
      imageBackupSize: safeOptimizedImages.reduce((sum, image) => sum + image.size, 0),
      fileSize: uploadedFileSize,
      originalBackupSize: safeOptimizedImages.reduce(
        (sum, image) => sum + image.originalSize,
        0
      ),
      imageQuality: settings.imageBackupQuality,
      userId: user.uid,
      localId: work.id,
      backupStatus: "backed_up",
      backupEnabledAt: backedUpAt,
      lastBackedUpAt: backedUpAt,
      sourceDeviceId,
      backedUpAt,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  if (
    await removeBackupIfImageWorkWasDeleted({
      user,
      work,
      backupSessionIds
    })
  ) {
    return null;
  }

  await refreshBackupOverview(user.uid, backedUpAt);
  await applyStorageSaverPolicy({
    settings,
    imageBundle: work,
    imageBundleBackup: {
      imageUris: backedUpImageUris,
      storagePath: storagePaths[0],
      backupStatus: "backed_up"
    }
  });

  return {
    ...work,
    imageUris: backedUpImageUris
  };
};

export const backupMadeVideo = async ({
  user,
  video,
  enabled,
  subscription
}: {
  user: User | null;
  video: MadeVideoItem;
  enabled: boolean;
  subscription?: UserSubscription | null;
}) => {
  if (!enabled || !user) {
    return null;
  }

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const [sourceDeviceId, settings] = await Promise.all([
    getSourceDeviceId(),
    getAppSettings()
  ]);
  if (!isCloudBackupTargetEnabled(settings, "videos")) {
    return null;
  }

  if (!(await isVideoStillBackupEligible(video.id))) {
    await removeBackupIfVideoWasDeleted({ user, video });
    return null;
  }

  const backedUpAt = new Date().toISOString();
  const existingSnapshot = await getDoc(
    doc(firestore, "users", user.uid, "videos", video.id)
  );
  const existingVideo = existingSnapshot.data() as
    | {
        backupStatus?: string;
        localId?: string;
        storagePath?: string;
      }
    | undefined;
  if (
    existingSnapshot.exists() &&
    existingVideo?.backupStatus === "backed_up" &&
    existingVideo.localId === video.id &&
    existingVideo.storagePath
  ) {
    return existingVideo;
  }

  if (video.localFileStatus === "cloud_only") {
    return null;
  }

  const currentVideoCount = await getCollectionSize(user.uid, "videos");
  const backupLimitTier = getBackupLimitTier(subscription);
  const videoLimit = getCloudBackupVideoLimit(backupLimitTier);
  if (!canBackupMoreVideos(currentVideoCount, backupLimitTier)) {
    throw new Error(
      `영상 백업 한도 ${videoLimit}개를 모두 사용했습니다. 설정에서 기존 영상 백업을 정리한 뒤 다시 시도해 주세요.`
    );
  }

  const fileName = fileNameFromUri(video.uri, `${video.id}.mp4`);
  const storagePath = `users/${user.uid}/backups/videos/${video.id}-${fileName}`;
  const upload = await uploadLocalFile({
    uri: video.uri,
    storagePath,
    mediaKind: "video"
  });
  const downloadUrl = upload.downloadURL;

  if (!(await isVideoStillBackupEligible(video.id))) {
    await releaseBackupUploads([upload.backupSessionId]);
    return null;
  }

  await setDoc(
    doc(firestore, "users", user.uid, "videos", video.id),
    {
      ...video,
      userId: user.uid,
      localId: video.id,
      localUri: video.uri,
      uri: downloadUrl,
      storagePath: upload.storagePath,
      fileSize: upload.fileSize,
      backupSessionId: upload.backupSessionId,
      backupStatus: "backed_up",
      backupEnabledAt: settings.cloudBackupEnabled ? backedUpAt : null,
      lastBackedUpAt: backedUpAt,
      sourceDeviceId,
      fileType: "video/mp4",
      backedUpAt,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  if (
    await removeBackupIfVideoWasDeleted({
      user,
      video,
      backupSessionId: upload.backupSessionId
    })
  ) {
    return null;
  }

  await refreshBackupOverview(user.uid, backedUpAt);
  await applyStorageSaverPolicy({
    settings,
    video,
    videoBackup: {
      downloadURL: downloadUrl,
      uri: downloadUrl,
      storagePath: upload.storagePath,
      backupStatus: "backed_up"
    }
  });

  return {
    ...video,
    uri: downloadUrl,
    storagePath: upload.storagePath
  };
};

const normalizePhotoBackup = (data: Record<string, unknown>, id: string): PhotoItem => ({
  ...(data as PhotoItem),
  id,
  uri:
    (typeof data.downloadURL === "string" && data.downloadURL) ||
    (typeof data.uri === "string" && data.uri) ||
    "",
  previewUri:
    (typeof data.previewUri === "string" && data.previewUri) ||
    (typeof data.downloadURL === "string" && data.downloadURL) ||
    undefined,
  createdAt: normalizeDateValue(data.createdAt) ?? new Date().toISOString(),
  width: typeof data.width === "number" ? data.width : 0,
  height: typeof data.height === "number" ? data.height : 0,
  ratioLabel: typeof data.ratioLabel === "string" ? data.ratioLabel : "Original",
  kind: data.kind === "edited" ? "edited" : "original",
  edited: Boolean(data.edited),
  addedToVideo: Boolean(data.addedToVideo),
  downloadURL:
    (typeof data.downloadURL === "string" && data.downloadURL) ||
    (typeof data.uri === "string" && /^https?:\/\//i.test(data.uri) && data.uri) ||
    undefined,
  localFileStatus: "cloud_only",
  backupStatus: "backed_up"
});

const normalizeImageWorkBackup = (
  data: Record<string, unknown>,
  id: string
): ImageBundleWorkItem => ({
  ...(data as ImageBundleWorkItem),
  id,
  kind: "image-bundle",
  title: typeof data.title === "string" ? data.title : "클라우드 백업 작업",
  createdAt: normalizeDateValue(data.createdAt) ?? new Date().toISOString(),
  ratio:
    data.ratio === "4:5" || data.ratio === "1:1" || data.ratio === "16:9" || data.ratio === "3:4"
      ? data.ratio
      : "9:16",
  photoIds: Array.isArray(data.photoIds) ? (data.photoIds as string[]) : [],
  imageUris: Array.isArray(data.imageUris) ? (data.imageUris as string[]) : [],
  localFileStatus: "cloud_only",
  backupStatus: "backed_up"
});

const normalizeVideoBackup = (
  data: Record<string, unknown>,
  id: string
): MadeVideoItem => ({
  ...(data as MadeVideoItem),
  id,
  uri: typeof data.uri === "string" ? data.uri : "",
  coverUri: typeof data.coverUri === "string" ? data.coverUri : undefined,
  createdAt: normalizeDateValue(data.createdAt) ?? new Date().toISOString(),
  title: typeof data.title === "string" ? data.title : "클라우드 백업 영상",
  ratio:
    data.ratio === "4:5" || data.ratio === "1:1" || data.ratio === "16:9" || data.ratio === "3:4"
      ? data.ratio
      : "9:16",
  template:
    data.template === "film-log" || data.template === "center-cut" || data.template === "reel-basic"
      ? data.template
      : "minimal",
  transition: data.transition === "slide" || data.transition === "zoom" ? data.transition : "fade",
  transitionDuration: typeof data.transitionDuration === "number" ? data.transitionDuration : 0.45,
  duration: typeof data.duration === "number" ? data.duration : 0,
  photoIds: Array.isArray(data.photoIds) ? (data.photoIds as string[]) : [],
  durations:
    data.durations && typeof data.durations === "object"
      ? (data.durations as Record<string, number>)
      : {},
  musicId: data.musicId === "custom" || typeof data.musicId === "string" ? (data.musicId as MadeVideoItem["musicId"]) : "none",
  musicLabel: typeof data.musicLabel === "string" ? data.musicLabel : "무음",
  downloadURL:
    (typeof data.downloadURL === "string" && data.downloadURL) ||
    (typeof data.uri === "string" && /^https?:\/\//i.test(data.uri) && data.uri) ||
    undefined,
  localFileStatus: "cloud_only",
  backupStatus: "backed_up"
});

export const restoreCloudBackupToLocal = async ({ user }: { user: User | null }) => {
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  if (!firestore) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const [photoSnapshot, imageWorkSnapshot, videoSnapshot] = await Promise.all([
    getDocs(collection(firestore, "users", user.uid, "photoBackups")),
    getDocs(collection(firestore, "users", user.uid, "imageWorks")),
    getDocs(collection(firestore, "users", user.uid, "videos"))
  ]);
  const photos = photoSnapshot.docs.map((item) =>
    normalizePhotoBackup(item.data(), item.id)
  );
  const imageWorks = imageWorkSnapshot.docs.map((item) =>
    normalizeImageWorkBackup(item.data(), item.id)
  );
  const videos = videoSnapshot.docs.map((item) =>
    normalizeVideoBackup(item.data(), item.id)
  );
  const [localPhotos, localImageWorks, localVideos] = await Promise.all([
    getPhotos(),
    getImageBundleWorks(),
    getMadeVideos()
  ]);
  const existingPhotoIds = new Set(localPhotos.map((item) => item.id));
  const deletedPhotoIds = await getDeletedPhotoIds();
  const existingImageWorkIds = new Set(localImageWorks.map((item) => item.id));
  const deletedImageWorkIds = await getDeletedImageWorkIds();
  const existingVideoIds = new Set(localVideos.map((item) => item.id));
  const deletedVideoIds = await getDeletedVideoIds();
  const missingPhotos = photos.filter(
    (item) => !existingPhotoIds.has(item.id) && !deletedPhotoIds.has(item.id)
  );
  const missingImageWorks = imageWorks.filter(
    (item) => !existingImageWorkIds.has(item.id) && !deletedImageWorkIds.has(item.id)
  );
  const missingVideos = videos.filter(
    (item) => !existingVideoIds.has(item.id) && !deletedVideoIds.has(item.id)
  );

  await Promise.all([
    replacePhotosFromBackup([...localPhotos, ...missingPhotos]),
    replaceImageBundleWorksFromBackup([...localImageWorks, ...missingImageWorks]),
    replaceMadeVideosFromBackup([...localVideos, ...missingVideos])
  ]);

  return {
    photoCount: missingPhotos.length,
    imageBundleCount: missingImageWorks.length,
    videoCount: missingVideos.length,
    imageBackupBytes: await getCurrentImageBackupSize({ userId: user.uid }),
    deleteAfter: null
  };
};

export const markBackupExpired = async ({
  user,
  subscription
}: {
  user: User | null;
  subscription: UserSubscription;
}) => {
  if (!user || !firestore || isCreatorSubscriptionActive(subscription)) {
    return;
  }

  const [photoCount, imageBundleCount, videoCount, imageBackupBytes] = await Promise.all([
    getCollectionSize(user.uid, "photoBackups"),
    getCollectionSize(user.uid, "imageWorks"),
    getCollectionSize(user.uid, "videos"),
    getCurrentImageBackupSize({ userId: user.uid })
  ]);

  await setDoc(
    doc(firestore, "users", user.uid, "backups", "current"),
    {
      userId: user.uid,
      photoCount,
      imageBundleCount,
      videoCount,
      imageBackupBytes,
      status: "expired",
      deleteAfter: null,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const deleteCloudBackupData = async ({ user }: { user: User | null }) => {
  if (!user) {
    throw new Error("로그인 후 백업 데이터를 삭제할 수 있습니다.");
  }

  return deleteCloudBackupDataCallable();
};
