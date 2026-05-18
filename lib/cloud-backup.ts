import { type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { getAppSettings } from "@/lib/app-settings";
import {
  IMAGE_BACKUP_SIZE_EXCEEDED_MESSAGE,
  IMAGE_OPTIMIZATION_FAILED_MESSAGE,
  MAX_TOTAL_IMAGE_BACKUP_SIZE_BYTES
} from "@/constants/image";
import {
  CLOUD_BACKUP_VIDEO_LIMIT,
  canBackupMoreVideos
} from "@/lib/cloud-backup-limits";
import { firestore, firebaseStorage } from "@/lib/firebase";
import {
  calculateCombinedImageBackupSize,
  isImageBackupSizeExceeded,
  optimizeImageForBackup,
  type OptimizedBackupImage
} from "@/lib/image-backup-utils";
import { getPhotos } from "@/lib/photo-library";
import { isCreatorSubscriptionActive, type UserSubscription } from "@/lib/subscription";
import { getMadeVideos } from "@/lib/video-library";
import { getImageBundleWorks } from "@/lib/work-library";
import type { MadeVideoItem } from "@/types/video";
import type { ImageBundleWorkItem } from "@/types/work";

export type BackupSummary = {
  photoCount: number;
  imageBundleCount: number;
  videoCount: number;
  imageBackupBytes: number;
  deleteAfter: string | null;
};

export type CloudBackupOverview = BackupSummary & {
  status: string;
  backedUpAt: string | null;
  deletedAt: string | null;
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

const uploadLocalFile = async ({
  uri,
  storagePath
}: {
  uri: string;
  storagePath: string;
}) => {
  if (!firebaseStorage) {
    throw new Error("Firebase Storage가 설정되지 않았습니다.");
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const fileRef = ref(firebaseStorage, storagePath);
  await uploadBytes(fileRef, blob, {
    contentType: getContentType(uri)
  });
  return getDownloadURL(fileRef);
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
  excludeImageWorkIds
}: {
  userId: string;
  newImages: OptimizedBackupImage[];
  excludePhotoIds?: string[];
  excludeImageWorkIds?: string[];
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

  if (isImageBackupSizeExceeded(totalSize, MAX_TOTAL_IMAGE_BACKUP_SIZE_BYTES)) {
    throw new Error(IMAGE_BACKUP_SIZE_EXCEEDED_MESSAGE);
  }

  return totalSize;
};

const refreshBackupOverview = async (userId: string) => {
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
      photoCount,
      imageBundleCount,
      videoCount,
      imageBackupBytes,
      status: overview.status,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return overview;
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
  subscription
}: {
  user: User | null;
  subscription: UserSubscription;
}): Promise<BackupSummary> => {
  if (!user) {
    throw new Error("로그인 후 백업할 수 있습니다.");
  }

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  ensureBackupAvailable(subscription);

  const [settings, photos, imageBundles, videos] = await Promise.all([
    getAppSettings(),
    getPhotos(),
    getImageBundleWorks(),
    getMadeVideos()
  ]);
  const backedUpAt = new Date().toISOString();
  const optimizedPhotos = await Promise.all(
    photos.map(async (photo) => ({
      photo,
      optimized: await optimizeImageForBackup({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        imageQuality: settings.imageBackupQuality
      })
    }))
  ).catch(() => {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  });
  const optimizedImageBundles = await Promise.all(
    imageBundles.map(async (work) => ({
      work,
      images: await Promise.all(
        work.imageUris.map((imageUri) =>
          optimizeImageForBackup({
            uri: imageUri,
            imageQuality: settings.imageBackupQuality
          })
        )
      )
    }))
  ).catch(() => {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  });
  const allOptimizedImages = [
    ...optimizedPhotos.map((item) => item.optimized),
    ...optimizedImageBundles.flatMap((item) => item.images)
  ];
  const imageBackupBytes = await assertImageBackupCapacity({
    userId: user.uid,
    newImages: allOptimizedImages,
    excludePhotoIds: photos.map((photo) => photo.id),
    excludeImageWorkIds: imageBundles.map((work) => work.id)
  });

  for (const { photo, optimized } of optimizedPhotos) {
    const photoFileName = fileNameFromUri(photo.uri, `${photo.id}.jpg`);
    const photoPath = `users/${user.uid}/backups/photos/${photo.id}-${photoFileName}.jpg`;
    const photoDownloadUrl = await uploadLocalFile({
      uri: optimized.uri,
      storagePath: photoPath
    });

    await setDoc(doc(firestore, "users", user.uid, "photoBackups", photo.id), {
      ...photo,
      uri: photoDownloadUrl,
      localUri: photo.uri,
      storagePath: photoPath,
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
      backedUpAt,
      updatedAt: serverTimestamp()
    });
  }

  for (const { work, images } of optimizedImageBundles) {
    const backedUpImageUris: string[] = [];
    const storagePaths: string[] = [];
    for (const [index, optimized] of images.entries()) {
      const fileName = fileNameFromUri(work.imageUris[index], `${work.id}-${index}.jpg`);
      const storagePath = `users/${user.uid}/backups/image-works/${work.id}/${index}-${fileName}.jpg`;
      const downloadUrl = await uploadLocalFile({
        uri: optimized.uri,
        storagePath
      });
      storagePaths.push(storagePath);
      backedUpImageUris.push(downloadUrl);
    }

    await setDoc(
      doc(firestore, "users", user.uid, "imageWorks", work.id),
      {
        ...work,
        localImageUris: work.imageUris,
        imageUris: backedUpImageUris,
        storagePaths,
        optimizedImages: images,
        imageBackupSize: images.reduce((sum, image) => sum + image.size, 0),
        originalBackupSize: images.reduce((sum, image) => sum + image.originalSize, 0),
        imageQuality: settings.imageBackupQuality,
        backedUpAt,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  await setDoc(
    doc(firestore, "users", user.uid, "backups", "current"),
    {
      userId: user.uid,
      settings,
      imageBundles,
      videos,
      photoCount: photos.length,
      imageBundleCount: imageBundles.length,
      videoCount: videos.length,
      imageBackupBytes,
      status: "active",
      backedUpAt,
      deleteAfter: null,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    photoCount: photos.length,
    imageBundleCount: imageBundles.length,
    videoCount: videos.length,
    imageBackupBytes,
    deleteAfter: null
  };
};

export const backupImageBundleWork = async ({
  user,
  work,
  enabled
}: {
  user: User | null;
  work: ImageBundleWorkItem;
  enabled: boolean;
}) => {
  if (!enabled || !user) {
    return null;
  }

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const settings = await getAppSettings();
  const optimizedImages = await Promise.all(
    work.imageUris.map((imageUri) =>
      optimizeImageForBackup({
        uri: imageUri,
        imageQuality: settings.imageBackupQuality
      })
    )
  ).catch(() => {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  });
  await assertImageBackupCapacity({
    userId: user.uid,
    newImages: optimizedImages,
    excludeImageWorkIds: [work.id]
  });

  const backedUpImageUris: string[] = [];
  const storagePaths: string[] = [];
  for (const [index, imageUri] of work.imageUris.entries()) {
    const fileName = fileNameFromUri(imageUri, `${work.id}-${index}.jpg`);
    const storagePath = `users/${user.uid}/backups/image-works/${work.id}/${index}-${fileName}.jpg`;
    const downloadUrl = await uploadLocalFile({
      uri: optimizedImages[index].uri,
      storagePath
    });
    storagePaths.push(storagePath);
    backedUpImageUris.push(downloadUrl);
  }

  await setDoc(
    doc(firestore, "users", user.uid, "imageWorks", work.id),
    {
      ...work,
      localImageUris: work.imageUris,
      imageUris: backedUpImageUris,
      storagePaths,
      optimizedImages,
      imageBackupSize: optimizedImages.reduce((sum, image) => sum + image.size, 0),
      originalBackupSize: optimizedImages.reduce(
        (sum, image) => sum + image.originalSize,
        0
      ),
      imageQuality: settings.imageBackupQuality,
      backedUpAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await refreshBackupOverview(user.uid);

  return {
    ...work,
    imageUris: backedUpImageUris
  };
};

export const backupMadeVideo = async ({
  user,
  video,
  enabled
}: {
  user: User | null;
  video: MadeVideoItem;
  enabled: boolean;
}) => {
  if (!enabled || !user) {
    return null;
  }

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const currentVideoCount = await getCollectionSize(user.uid, "videos");
  if (!canBackupMoreVideos(currentVideoCount)) {
    throw new Error(
      `영상 백업 한도 ${CLOUD_BACKUP_VIDEO_LIMIT}개를 모두 사용했습니다. 설정에서 기존 영상 백업을 정리한 뒤 다시 시도해 주세요.`
    );
  }

  const fileName = fileNameFromUri(video.uri, `${video.id}.mp4`);
  const storagePath = `users/${user.uid}/backups/videos/${video.id}-${fileName}`;
  const downloadUrl = await uploadLocalFile({
    uri: video.uri,
    storagePath
  });

  await setDoc(
    doc(firestore, "users", user.uid, "videos", video.id),
    {
      ...video,
      localUri: video.uri,
      uri: downloadUrl,
      storagePath,
      backedUpAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await refreshBackupOverview(user.uid);

  return {
    ...video,
    uri: downloadUrl
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

  await setDoc(
    doc(firestore, "users", user.uid, "backups", "current"),
    {
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

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const photoSnapshot = await getDocs(collection(firestore, "users", user.uid, "photoBackups"));
  for (const item of photoSnapshot.docs) {
    const data = item.data() as {
      storagePath?: string | null;
      previewStoragePath?: string | null;
    };

    if (data.storagePath) {
      await deleteObject(ref(firebaseStorage, data.storagePath)).catch(() => undefined);
    }

    if (data.previewStoragePath) {
      await deleteObject(ref(firebaseStorage, data.previewStoragePath)).catch(() => undefined);
    }

    await deleteDoc(item.ref);
  }

  const imageWorkSnapshot = await getDocs(collection(firestore, "users", user.uid, "imageWorks"));
  for (const item of imageWorkSnapshot.docs) {
    const data = item.data() as {
      storagePaths?: string[] | null;
    };

    for (const storagePath of data.storagePaths ?? []) {
      await deleteObject(ref(firebaseStorage, storagePath)).catch(() => undefined);
    }

    await deleteDoc(item.ref);
  }

  const videoSnapshot = await getDocs(collection(firestore, "users", user.uid, "videos"));
  for (const item of videoSnapshot.docs) {
    const data = item.data() as {
      storagePath?: string | null;
    };

    if (data.storagePath) {
      await deleteObject(ref(firebaseStorage, data.storagePath)).catch(() => undefined);
    }

    await deleteDoc(item.ref);
  }

  await setDoc(
    doc(firestore, "users", user.uid, "backups", "current"),
    {
      status: "deleted",
      photoCount: 0,
      imageBundleCount: 0,
      videoCount: 0,
      imageBackupBytes: 0,
      deletedAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    photoCount: photoSnapshot.size,
    imageBundleCount: imageWorkSnapshot.size,
    videoCount: videoSnapshot.size,
    imageBackupBytes: 0,
    deleteAfter: null
  };
};
