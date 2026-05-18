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
  CLOUD_BACKUP_VIDEO_LIMIT,
  canBackupMoreVideos
} from "@/lib/cloud-backup-limits";
import { firestore, firebaseStorage } from "@/lib/firebase";
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

const refreshBackupOverview = async (userId: string) => {
  if (!firestore) {
    return emptyBackupOverview;
  }

  const [photoCount, imageBundleCount, videoCount] = await Promise.all([
    getCollectionSize(userId, "photoBackups"),
    getCollectionSize(userId, "imageWorks"),
    getCollectionSize(userId, "videos")
  ]);

  const overview: CloudBackupOverview = {
    ...emptyBackupOverview,
    photoCount,
    imageBundleCount,
    videoCount,
    status: photoCount + imageBundleCount + videoCount > 0 ? "active" : "none"
  };

  await setDoc(
    doc(firestore, "users", userId, "backups", "current"),
    {
      photoCount,
      imageBundleCount,
      videoCount,
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

  for (const photo of photos) {
    const photoFileName = fileNameFromUri(photo.uri, `${photo.id}.jpg`);
    const photoPath = `users/${user.uid}/backups/photos/${photo.id}-${photoFileName}`;
    const photoDownloadUrl = await uploadLocalFile({
      uri: photo.uri,
      storagePath: photoPath
    });
    let previewDownloadUrl: string | null = null;
    let previewPath: string | null = null;

    if (photo.previewUri) {
      const previewFileName = fileNameFromUri(photo.previewUri, `${photo.id}-preview.jpg`);
      previewPath = `users/${user.uid}/backups/photo-previews/${photo.id}-${previewFileName}`;
      previewDownloadUrl = await uploadLocalFile({
        uri: photo.previewUri,
        storagePath: previewPath
      });
    }

    await setDoc(doc(firestore, "users", user.uid, "photoBackups", photo.id), {
      ...photo,
      uri: photoDownloadUrl,
      localUri: photo.uri,
      storagePath: photoPath,
      previewUri: previewDownloadUrl,
      localPreviewUri: photo.previewUri ?? null,
      previewStoragePath: previewPath,
      backedUpAt,
      updatedAt: serverTimestamp()
    });
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

  const backedUpImageUris: string[] = [];
  for (const [index, imageUri] of work.imageUris.entries()) {
    const fileName = fileNameFromUri(imageUri, `${work.id}-${index}.jpg`);
    const storagePath = `users/${user.uid}/backups/image-works/${work.id}/${index}-${fileName}`;
    const downloadUrl = await uploadLocalFile({ uri: imageUri, storagePath });
    backedUpImageUris.push(downloadUrl);
  }

  await setDoc(
    doc(firestore, "users", user.uid, "imageWorks", work.id),
    {
      ...work,
      localImageUris: work.imageUris,
      imageUris: backedUpImageUris,
      storagePaths: work.imageUris.map((_, index) => {
        const fileName = fileNameFromUri(work.imageUris[index], `${work.id}-${index}.jpg`);
        return `users/${user.uid}/backups/image-works/${work.id}/${index}-${fileName}`;
      }),
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
      deletedAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    photoCount: photoSnapshot.size,
    imageBundleCount: imageWorkSnapshot.size,
    videoCount: videoSnapshot.size,
    deleteAfter: null
  };
};
