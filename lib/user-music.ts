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
import { localStorageAdapter } from "@/lib/local-storage";

export type UserMusicTrack = {
  id: string;
  userId: string;
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  storagePath: string;
  downloadUrl?: string;
  createdAt: string;
};

const MAX_USER_MUSIC_TRACKS = 3;
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

const getExtension = (name?: string | null, mimeType?: string | null) => {
  const match = name?.split("?")[0]?.match(/\.([a-zA-Z0-9]+)$/);
  if (match?.[1]) {
    return match[1].toLowerCase();
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
    throw new Error("Firebase Functions가 설정되지 않았습니다.");
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
    throw new Error("Firebase Storage가 설정되지 않았습니다.");
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
  const directory = await ensureMusicDirectory(user.uid);
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

    if (!localUri && data.downloadUrl) {
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
      createdAt: data.createdAt
    });
  }

  const sortedTracks = nextTracks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await saveTracksToCache(user.uid, sortedTracks);
  return sortedTracks;
};

export const pickAndUploadUserMusicTrack = async (user: User | null) => {
  if (!user) {
    throw new Error("로그인 후 내 음악을 추가할 수 있습니다.");
  }

  if (!firestore || !firebaseStorage) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  const currentTracks = await syncUserMusicTracks(user);
  if (currentTracks.length >= MAX_USER_MUSIC_TRACKS) {
    throw new Error("내 음악은 최대 3개까지 저장할 수 있습니다.");
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
    createdAt
  };

  const nextTracks = [track, ...currentTracks].slice(0, MAX_USER_MUSIC_TRACKS);
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

  if (track.uri?.startsWith("file://")) {
    await FileSystem.deleteAsync(track.uri, { idempotent: true });
  }

  const nextTracks = (await getUserMusicTracks(user.uid)).filter(
    (item) => item.id !== track.id
  );
  await saveTracksToCache(user.uid, nextTracks);
  return nextTracks;
};

export const USER_MUSIC_LIMIT = MAX_USER_MUSIC_TRACKS;
