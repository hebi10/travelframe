import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { firestore, firebaseFunctions, firebaseStorage } from "@/lib/firebase";
import { getAppSettings } from "@/lib/app-settings";
import { localStorageAdapter } from "@/lib/local-storage";
import { isStorageSaverMode } from "@/lib/storage-mode";

export type UserMusicTrack = {
  id: string;
  userId: string;
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  storagePath?: string;
  downloadUrl?: string;
  backupStatus?: "backed_up" | "local_only";
  createdAt: string;
};

const MAX_USER_MUSIC_TRACKS = 20;
const USER_MUSIC_MAX_FILE_BYTES = 50 * 1024 * 1024;
const SUPPORTED_USER_MUSIC_EXTENSIONS = new Set(["mp3", "m4a", "wav", "aac", "ogg", "flac"]);
const DANGEROUS_USER_MUSIC_EXTENSIONS = new Set(["apk", "app", "bat", "cmd", "com", "exe", "js", "msi", "ps1", "sh", "vbs"]);
const MUSIC_CACHE_PREFIX = "travel-frame:user-music:v1";

const getMusicCacheKey = (userId: string) => `${MUSIC_CACHE_PREFIX}:${userId}`;

const getMusicDirectory = (userId: string) => {
  if (!FileSystem.documentDirectory) {
    throw new Error("이 기기에서는 음악 파일을 저장할 수 없습니다.");
  }

  return `${FileSystem.documentDirectory}user-music/${userId}/`;
};

const ensureMusicDirectory = async (userId: string) => {
  const directory = getMusicDirectory(userId);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

const sanitizeFileName = (name: string) =>
  name
    .trim()
    .replace(/[\\/:*?"<>|#%{}\[\]\^~`]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);

const getFileExtension = (name?: string | null) => {
  const match = name?.split("?")[0]?.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase();
};

const getExtension = (name?: string | null, mimeType?: string | null) => {
  const extension = getFileExtension(name);
  if (extension) {
    return extension;
  }

  if (mimeType?.includes("mpeg")) {
    return "mp3";
  }

  if (mimeType?.includes("mp4") || mimeType?.includes("m4a")) {
    return "m4a";
  }

  if (mimeType?.includes("wav")) {
    return "wav";
  }

  return "mp3";
};

const normalizeTrackName = (name?: string | null) => {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "내 음악";
};

const getContentType = (mimeType?: string | null) =>
  mimeType && mimeType.startsWith("audio/") ? mimeType : "audio/mpeg";

const validatePickedMusicAsset = (asset: DocumentPicker.DocumentPickerAsset) => {
  const extension = getFileExtension(asset.name);

  if (typeof asset.size === "number" && asset.size > USER_MUSIC_MAX_FILE_BYTES) {
    throw new Error("Invalid music file size.");
  }

  if (!asset.mimeType?.startsWith("audio/")) {
    throw new Error("Invalid music content type.");
  }

  if (
    !extension ||
    DANGEROUS_USER_MUSIC_EXTENSIONS.has(extension) ||
    !SUPPORTED_USER_MUSIC_EXTENSIONS.has(extension)
  ) {
    throw new Error("Unsupported music file extension.");
  }
};

type ReserveMusicUploadResponse = {
  musicSessionId: string;
  storagePath: string;
  expiresInSeconds: number;
};

const callMusicFunction = async <Request, Response>(
  name: string,
  data: Request
): Promise<Response> => {
  if (!firebaseFunctions) {
    throw new Error("음악 백업을 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }

  const callable = httpsCallable<Request, Response>(firebaseFunctions, name);
  const result = await callable(data);
  return result.data;
};

const reserveMusicUpload = (data: {
  trackId: string;
  name: string;
  fileSize: number;
  contentType: string;
  storagePath: string;
}) =>
  callMusicFunction<typeof data, ReserveMusicUploadResponse>(
    "reserveMusicUpload",
    data
  );

const completeMusicUpload = (data: {
  musicSessionId: string;
  trackId: string;
  name: string;
  downloadUrl: string;
  createdAt: string;
}) => callMusicFunction<typeof data, { trackId: string }>("completeMusicUpload", data);

const releaseMusicUpload = (data: { musicSessionId: string }) =>
  callMusicFunction<typeof data, { released: boolean }>("releaseMusicUpload", data);

const saveTracksToCache = async (userId: string, tracks: UserMusicTrack[]) => {
  await localStorageAdapter.setItem(getMusicCacheKey(userId), JSON.stringify(tracks));
};

export const getUserMusicTracks = async (userId?: string | null) => {
  if (!userId) {
    return [];
  }

  const value = await localStorageAdapter.getItem(getMusicCacheKey(userId));
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value) as UserMusicTrack[];
  } catch {
    return [];
  }
};

const uploadLocalAudioFile = async ({
  uri,
  storagePath,
  contentType,
  trackId,
  name,
  createdAt
}: {
  uri: string;
  storagePath: string;
  contentType: string;
  trackId: string;
  name: string;
  createdAt: string;
}) => {
  if (!firebaseStorage) {
    throw new Error("음악 백업을 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const reservation = await reserveMusicUpload({
    trackId,
    name,
    fileSize: blob.size,
    contentType,
    storagePath
  });
  const fileRef = ref(firebaseStorage, storagePath);

  try {
    await uploadBytes(fileRef, blob, {
      contentType,
      customMetadata: {
        musicSessionId: reservation.musicSessionId
      }
    });
    const downloadUrl = await getDownloadURL(fileRef);
    await completeMusicUpload({
      musicSessionId: reservation.musicSessionId,
      trackId,
      name,
      downloadUrl,
      createdAt
    });
    return downloadUrl;
  } catch (error) {
    await releaseMusicUpload({
      musicSessionId: reservation.musicSessionId
    }).catch(() => undefined);
    await deleteObject(fileRef).catch(() => undefined);
    throw error;
  }
};

export const syncUserMusicTracks = async (user: User | null) => {
  if (!user) {
    return [];
  }

  const cachedTracks = await getUserMusicTracks(user.uid);

  if (!firestore || !firebaseStorage) {
    return cachedTracks;
  }

  const snapshot = await getDocs(collection(firestore, "users", user.uid, "musicTracks"));
  const remoteTrackIds = new Set(snapshot.docs.map((item) => item.id));
  const directory = await ensureMusicDirectory(user.uid);
  const settings = await getAppSettings();
  const nextTracks: UserMusicTrack[] = [];

  for (const item of snapshot.docs) {
    const data = item.data() as Omit<UserMusicTrack, "id" | "uri"> & {
      localUri?: string;
      downloadUrl?: string;
    };
    const cachedTrack = cachedTracks.find((track) => track.id === item.id);
    let localUri = cachedTrack?.uri ?? data.localUri;

    if (localUri) {
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        localUri = undefined;
      }
    }

    if (!localUri && data.downloadUrl && !isStorageSaverMode(settings.storageMode, true)) {
      const extension = getExtension(data.name, data.mimeType);
      const fileName = `${item.id}-${sanitizeFileName(data.name)}.${extension}`;
      const destination = `${directory}${fileName}`;
      try {
        const result = await FileSystem.downloadAsync(data.downloadUrl, destination);
        localUri = result.uri;
      } catch {
        localUri = data.downloadUrl;
      }
    }

    nextTracks.push({
      id: item.id,
      userId: user.uid,
      name: data.name,
      uri: localUri ?? data.downloadUrl ?? "",
      mimeType: data.mimeType,
      size: data.size,
      storagePath: data.storagePath,
      downloadUrl: data.downloadUrl,
      backupStatus: data.backupStatus ?? "backed_up",
      createdAt: data.createdAt
    });
  }

  const localOnlyTracks = cachedTracks.filter(
    (track) => track.backupStatus === "local_only" && !remoteTrackIds.has(track.id)
  );
  const sortedTracks = [...nextTracks, ...localOnlyTracks].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  await saveTracksToCache(user.uid, sortedTracks);
  return sortedTracks;
};

export const deleteLocalMusicFile = async (track: UserMusicTrack) => {
  if (track.uri?.startsWith("file://")) {
    await FileSystem.deleteAsync(track.uri, { idempotent: true });
  }
};

export const restoreUserMusicTrackIfNeeded = async (
  user: User | null,
  track: UserMusicTrack
) => {
  if (!user || track.uri?.startsWith("file://") || !track.downloadUrl) {
    return track;
  }

  const directory = await ensureMusicDirectory(user.uid);
  const extension = getExtension(track.name, track.mimeType);
  const destination = `${directory}${track.id}-${sanitizeFileName(track.name)}.${extension}`;
  const result = await FileSystem.downloadAsync(track.downloadUrl, destination);
  const nextTrack = {
    ...track,
    uri: result.uri
  };
  const tracks = await getUserMusicTracks(user.uid);
  await saveTracksToCache(
    user.uid,
    tracks.map((item) => (item.id === track.id ? nextTrack : item))
  );
  return nextTrack;
};

export const pickAndUploadUserMusicTrack = async (
  user: User | null,
  musicTrackLimit = 0,
  options: { uploadToCloud?: boolean } = {}
) => {
  if (!user) {
    throw new Error("로그인 후 내 음악을 추가할 수 있습니다.");
  }

  const { uploadToCloud = true } = options;

  if (uploadToCloud && (!firestore || !firebaseStorage)) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const currentTracks = await syncUserMusicTracks(user);
  const safeMusicTrackLimit = Math.max(
    0,
    Math.min(MAX_USER_MUSIC_TRACKS, Math.floor(Number(musicTrackLimit) || 0))
  );

  if (safeMusicTrackLimit <= 0) {
    throw new Error("Pro 구독 후 내 음악을 추가할 수 있습니다.");
  }

  if (currentTracks.length >= safeMusicTrackLimit) {
    throw new Error(`내 음악은 최대 ${safeMusicTrackLimit}개까지 저장할 수 있습니다.`);
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: "audio/*",
    multiple: false,
    copyToCacheDirectory: true
  });

  if (result.canceled || result.assets.length === 0) {
    return currentTracks;
  }

  const asset = result.assets[0];
  validatePickedMusicAsset(asset);
  const id = `music-${Date.now()}`;
  const name = normalizeTrackName(asset.name);
  const extension = getExtension(name, asset.mimeType);
  const directory = await ensureMusicDirectory(user.uid);
  const fileName = `${id}-${sanitizeFileName(name)}.${extension}`;
  const localUri = `${directory}${fileName}`;
  const createdAt = new Date().toISOString();

  await FileSystem.copyAsync({
    from: asset.uri,
    to: localUri
  });

  if (!uploadToCloud) {
    const track: UserMusicTrack = {
      id,
      userId: user.uid,
      name,
      uri: localUri,
      mimeType: asset.mimeType ?? getContentType(asset.mimeType),
      size: asset.size,
      storagePath: "",
      backupStatus: "local_only",
      createdAt
    };
    const nextTracks = [track, ...currentTracks].slice(0, safeMusicTrackLimit);
    await saveTracksToCache(user.uid, nextTracks);
    return nextTracks;
  }

  const storagePath = `users/${user.uid}/music/${fileName}`;
  const downloadUrl = await uploadLocalAudioFile({
    uri: localUri,
    storagePath,
    contentType: getContentType(asset.mimeType),
    trackId: id,
    name,
    createdAt
  });
  const track: UserMusicTrack = {
    id,
    userId: user.uid,
    name,
    uri: localUri,
    mimeType: asset.mimeType ?? getContentType(asset.mimeType),
    size: asset.size,
    storagePath,
    downloadUrl,
    backupStatus: "backed_up",
    createdAt
  };

  const settings = await getAppSettings();
  const savedTrack = isStorageSaverMode(settings.storageMode, true)
    ? {
        ...track,
        uri: downloadUrl
      }
    : track;

  if (isStorageSaverMode(settings.storageMode, true)) {
    await deleteLocalMusicFile(track);
  }

  const nextTracks = [savedTrack, ...currentTracks].slice(0, safeMusicTrackLimit);
  await saveTracksToCache(user.uid, nextTracks);
  return nextTracks;
};

export const deleteUserMusicTrack = async ({
  user,
  track
}: {
  user: User | null;
  track: UserMusicTrack;
}) => {
  if (!user) {
    throw new Error("로그인 후 내 음악을 삭제할 수 있습니다.");
  }

  if (firestore) {
    await deleteDoc(doc(firestore, "users", user.uid, "musicTracks", track.id));
  }

  if (firebaseStorage && track.storagePath) {
    await deleteObject(ref(firebaseStorage, track.storagePath)).catch(() => undefined);
  }

  await deleteLocalMusicFile(track);

  const nextTracks = (await getUserMusicTracks(user.uid)).filter(
    (item) => item.id !== track.id
  );
  await saveTracksToCache(user.uid, nextTracks);
  return nextTracks;
};

export const USER_MUSIC_LIMIT = MAX_USER_MUSIC_TRACKS;
