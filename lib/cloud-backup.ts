import * as FileSystem from "expo-file-system/legacy";
import { type User } from "firebase/auth";
import {
  collection,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPlanTier } from "@/lib/plan-entitlements";
import {
  getDeletedPhotoIds,
  getPhotos,
  replacePhotosFromBackup,
  wasPhotoDeletedLocally
} from "@/lib/photo-library";
import { isCreatorSubscriptionActive, type UserSubscription } from "@/lib/subscription";
import { shouldUseCloudBackupForStorageMode } from "@/lib/storage-mode";
import {
  getDeletedVideoIds,
  getMadeVideos,
  replaceMadeVideosFromBackup,
  wasVideoDeletedLocally
} from "@/lib/video-library";
import {
  getDeletedImageWorkIds,
  getImageBundleWorks,
  replaceImageBundleWorksFromBackup,
  wasImageWorkDeletedLocally
} from "@/lib/work-library";
import type { PhotoItem } from "@/types/photo";
import type { MadeVideoItem } from "@/types/video";
import type { ImageBundleWorkItem } from "@/types/work";

const BACKUP_IMAGE_OPTIMIZATION_CONCURRENCY = 2;

type OptimizedBackupImageCleanup = {
  optimized: OptimizedBackupImage;
  sourceUri: string;
};

const mapWithConcurrencyLimit = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
};

const cleanupOptimizedBackupImage = async ({
  optimized,
  sourceUri
}: OptimizedBackupImageCleanup) => {
  if (optimized.uri === sourceUri || !optimized.uri.startsWith("file:")) {
    return;
  }

  await FileSystem.deleteAsync(optimized.uri, { idempotent: true }).catch(() => undefined);
};

const cleanupOptimizedBackupImages = async (items: OptimizedBackupImageCleanup[]) => {
  await Promise.all(items.map((item) => cleanupOptimizedBackupImage(item)));
};

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
    throw new Error("?대씪?곕뱶 諛깆뾽??吏湲??ъ슜?????놁뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??");
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
      throw new Error("?대씪?곕뱶 諛깆뾽??吏湲??ъ슜?????놁뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??");
    }

    if (
      code.includes("permission-denied") ||
      message.includes("Active backup subscription")
    ) {
      throw new Error(
        "援щ룆???쒖꽦?붾맂 怨꾩젙留?諛깆뾽?????덉뒿?덈떎. 愿由ъ옄 ?섏씠吏?먯꽌 援щ룆 ?곹깭瑜??뺤씤??二쇱꽭??"
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

const completeImageWorkBackup = (data: {
  workId: string;
  imageWork: Record<string, unknown>;
}) =>
  callBackupFunction<typeof data, { saved: boolean }>(
    "completeImageWorkBackup",
    data
  );

const releaseBackupUpload = (data: { backupSessionId: string }) =>
  callBackupFunction<typeof data, { released: boolean }>("releaseBackupUpload", data);

const deleteCloudBackupDataCallable = () =>
  callBackupFunction<Record<string, never>, BackupSummary>(
    "deleteCloudBackupData",
    {}
  );

const deleteUserBackupItem = (data: {
  itemType: "photo" | "imageWork" | "video" | "music";
  itemId: string;
}) =>
  callBackupFunction<typeof data, { deleted: boolean; summary: BackupSummary }>(
    "deleteUserBackupItem",
    data
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
  const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (storedDeviceId) {
    return storedDeviceId;
  }

  const nextDeviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, nextDeviceId);
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
    throw new Error("?대씪?곕뱶 諛깆뾽??吏湲??ъ슜?????놁뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??");
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

  if (!firebaseFunctions) {
    return false;
  }

  await deleteUserBackupItem({ itemType: "photo", itemId: photo.id });
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

  if (!firebaseFunctions) {
    return false;
  }

  await deleteUserBackupItem({ itemType: "imageWork", itemId: work.id });
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

  if (!firebaseFunctions) {
    return false;
  }

  await deleteUserBackupItem({ itemType: "video", itemId: video.id });
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
    "援щ룆 湲곌컙??留뚮즺?섏뼱 諛깆뾽???ъ슜?????놁뒿?덈떎. 湲곗〈 諛깆뾽 ?곗씠????젣???ㅼ젙?먯꽌 吏곸젒 ?붿껌?????덉뒿?덈떎."
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
    throw new Error("濡쒓렇????諛깆뾽?????덉뒿?덈떎.");
  }

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase ?곌껐 ?뺣낫媛 ?꾩쭅 ?ㅼ젙?섏? ?딆븯?듬땲??");
  }

  ensureBackupAvailable(subscription);
  const backupLimitTier = getBackupLimitTier(subscription);
  emitBackupProgress(onProgress, 3, "諛깆뾽???곗씠?곕? 以鍮꾪븯怨??덉뒿?덈떎.");

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
  emitBackupProgress(onProgress, 8, "諛깆뾽???곗씠?곕? ?뺤씤?섍퀬 ?덉뒿?덈떎.");
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
      "?대?吏瑜?理쒖쟻?뷀븯怨??덉뒿?덈떎."
    );
  };
  const optimizedImagesForCleanup: OptimizedBackupImageCleanup[] = [];
  try {
  const optimizedPhotos = (await mapWithConcurrencyLimit(
    backupablePhotoBackups,
    BACKUP_IMAGE_OPTIMIZATION_CONCURRENCY,
    async (photo) => {
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
      optimizedImagesForCleanup.push({ optimized, sourceUri: photo.uri });
      updateOptimizationProgress();
      return { photo, optimized };
    }
  ).catch(() => {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  })).filter((item): item is { photo: PhotoItem; optimized: OptimizedBackupImage } =>
    Boolean(item)
  );
  const optimizedImageBundles = (await mapWithConcurrencyLimit(
    backupableImageBundleBackups,
    BACKUP_IMAGE_OPTIMIZATION_CONCURRENCY,
    async (work) => {
      if (!(await isImageWorkStillBackupEligible(work.id))) {
        return null;
      }

      const images = await mapWithConcurrencyLimit(
        work.imageUris,
        BACKUP_IMAGE_OPTIMIZATION_CONCURRENCY,
        async (imageUri, index) => {
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
          optimizedImagesForCleanup.push({ optimized, sourceUri: imageUri });
          updateOptimizationProgress();
          return optimized;
        }
      );

      if (images.some((image) => !image)) {
        return null;
      }

      return { work, images: images as OptimizedBackupImage[] };
    }
  ).catch(() => {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  })).filter((item): item is { work: ImageBundleWorkItem; images: OptimizedBackupImage[] } =>
    Boolean(item)
  );
  if (totalOptimizeItems === 0) {
    emitBackupProgress(onProgress, 45, "諛깆뾽???대?吏媛 ?덈뒗吏 ?뺤씤?섍퀬 ?덉뒿?덈떎.");
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
  emitBackupProgress(onProgress, 50, "諛깆뾽 ?⑸웾???뺤씤?덉뒿?덈떎.");

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
      "Firebase??諛깆뾽?섍퀬 ?덉뒿?덈떎."
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

    const imageWorkBackup = {
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
      updatedAt: backedUpAt
    };
    await completeImageWorkBackup({
      workId: work.id,
      imageWork: imageWorkBackup
    });
    if (
      await removeBackupIfImageWorkWasDeleted({
        user,
        work,
        backupSessionIds
      })
    ) {
      continue;
    }
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
    updateUploadProgress();
  }

  if (totalUploadItems === 0) {
    emitBackupProgress(onProgress, 92, "Firebase??諛깆뾽???뚯씪???뺤씤?덉뒿?덈떎.");
  }

  emitBackupProgress(onProgress, 96, "諛깆뾽??留덈Т由ы븯怨??덉뒿?덈떎.");
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
  emitBackupProgress(onProgress, 100, "諛깆뾽???꾨즺?덉뒿?덈떎.");

  return {
    photoCount: overview.photoCount,
    imageBundleCount: overview.imageBundleCount,
    videoCount: overview.videoCount,
    imageBackupBytes: overview.imageBackupBytes,
    deleteAfter: null
  };
  } finally {
    await cleanupOptimizedBackupImages(optimizedImagesForCleanup);
  }
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
    throw new Error("Firebase ?곌껐 ?뺣낫媛 ?꾩쭅 ?ㅼ젙?섏? ?딆븯?듬땲??");
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

  try {
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

  return {
    ...photo,
    uri: downloadURL,
    previewUri: downloadURL,
    storagePath: upload.storagePath,
    downloadURL,
    backupStatus: "backed_up" as const
  };
  } finally {
    await cleanupOptimizedBackupImage({ optimized, sourceUri: photo.uri });
  }
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
    throw new Error("Firebase ?곌껐 ?뺣낫媛 ?꾩쭅 ?ㅼ젙?섏? ?딆븯?듬땲??");
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
  const optimizedImagesForCleanup: OptimizedBackupImageCleanup[] = [];
  try {
  const optimizedImages = await mapWithConcurrencyLimit(
    work.imageUris,
    BACKUP_IMAGE_OPTIMIZATION_CONCURRENCY,
    async (imageUri, index) => {
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
      optimizedImagesForCleanup.push({ optimized, sourceUri: imageUri });
      return optimized;
    }
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

  const imageWorkBackup = {
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
    updatedAt: backedUpAt
  };
  await completeImageWorkBackup({
    workId: work.id,
    imageWork: imageWorkBackup
  });
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

  return {
    ...work,
    imageUris: backedUpImageUris
  };
  } finally {
    await cleanupOptimizedBackupImages(optimizedImagesForCleanup);
  }
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
    throw new Error("Firebase ?곌껐 ?뺣낫媛 ?꾩쭅 ?ㅼ젙?섏? ?딆븯?듬땲??");
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
      `?곸긽 諛깆뾽 ?쒕룄 ${videoLimit}媛쒕? 紐⑤몢 ?ъ슜?덉뒿?덈떎. ?ㅼ젙?먯꽌 湲곗〈 ?곸긽 諛깆뾽???뺣━?????ㅼ떆 ?쒕룄??二쇱꽭??`
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
  title: typeof data.title === "string" ? data.title : "?대씪?곕뱶 諛깆뾽 ?묒뾽",
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
  title: typeof data.title === "string" ? data.title : "?대씪?곕뱶 諛깆뾽 ?곸긽",
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
  musicLabel: typeof data.musicLabel === "string" ? data.musicLabel : "臾댁쓬",
  downloadURL:
    (typeof data.downloadURL === "string" && data.downloadURL) ||
    (typeof data.uri === "string" && /^https?:\/\//i.test(data.uri) && data.uri) ||
    undefined,
  localFileStatus: "cloud_only",
  backupStatus: "backed_up"
});

export const restoreCloudBackupToLocal = async ({ user }: { user: User | null }) => {
  if (!user) {
    throw new Error("濡쒓렇?몄씠 ?꾩슂?⑸땲??");
  }

  if (!firestore) {
    throw new Error("Firebase ?곌껐 ?뺣낫媛 ?꾩쭅 ?ㅼ젙?섏? ?딆븯?듬땲??");
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
    throw new Error("濡쒓렇????諛깆뾽 ?곗씠?곕? ??젣?????덉뒿?덈떎.");
  }

  return deleteCloudBackupDataCallable();
};
