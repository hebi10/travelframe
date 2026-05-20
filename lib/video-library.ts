import * as FileSystem from "expo-file-system/legacy";

import { localStorageAdapter } from "@/lib/local-storage";
import { assertLocalLibraryCapacity } from "@/lib/local-library-limit";
import type { MadeVideoItem } from "@/types/video";

const VIDEO_STORAGE_KEY = "travel-frame.videos.v1";
const VIDEO_DIRECTORY = "made-videos/";

const createVideoId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sortVideos = (videos: MadeVideoItem[]) =>
  [...videos].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  );

const parseVideos = (value: string | null): MadeVideoItem[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? sortVideos(parsed as MadeVideoItem[]) : [];
  } catch {
    return [];
  }
};

const writeVideos = async (videos: MadeVideoItem[]) => {
  await localStorageAdapter.setItem(VIDEO_STORAGE_KEY, JSON.stringify(sortVideos(videos)));
};

const getVideoDirectory = () => {
  if (!FileSystem.documentDirectory) {
    throw new Error("기기에서 영상 파일 저장소를 사용할 수 없습니다.");
  }

  return `${FileSystem.documentDirectory}${VIDEO_DIRECTORY}`;
};

const ensureVideoDirectory = async () => {
  const directory = getVideoDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

const isRemoteUri = (uri?: string | null) =>
  typeof uri === "string" && /^https?:\/\//i.test(uri);

export const getMadeVideos = async () => {
  const value = await localStorageAdapter.getItem(VIDEO_STORAGE_KEY);
  return parseVideos(value);
};

export const getMadeVideoById = async (id: string) => {
  const videos = await getMadeVideos();
  const video = videos.find((item) => item.id === id) ?? null;
  return video ? restoreMadeVideoIfNeeded(video) : null;
};

export const replaceMadeVideosFromBackup = async (videos: MadeVideoItem[]) => {
  await writeVideos(videos);
  return getMadeVideos();
};

export const saveMadeVideo = async (
  video: Omit<MadeVideoItem, "id" | "createdAt" | "title"> & {
    title?: string;
  },
  options: { localVideoLimit?: number } = {}
) => {
  const videos = await getMadeVideos();
  assertLocalLibraryCapacity({
    currentCount: videos.length,
    limit: options.localVideoLimit,
    label: "영상"
  });
  const createdAt = new Date().toISOString();
  const savedVideo: MadeVideoItem = {
    ...video,
    id: createVideoId(),
    createdAt,
    title: video.title ?? `여행 클립 ${videos.length + 1}`
  };

  await writeVideos([savedVideo, ...videos]);
  return savedVideo;
};

export const restoreMadeVideoIfNeeded = async (video: MadeVideoItem) => {
  if (video.localFileStatus !== "cloud_only") {
    return video;
  }

  const sourceUri = video.downloadURL ?? (isRemoteUri(video.uri) ? video.uri : null);
  if (!sourceUri) {
    return video;
  }

  const directory = await ensureVideoDirectory();
  const destinationUri = `${directory}${video.id}-restored.mp4`;
  const result = await FileSystem.downloadAsync(sourceUri, destinationUri);
  const videos = await getMadeVideos();
  const restoredVideo: MadeVideoItem = {
    ...video,
    uri: result.uri,
    localUri: result.uri,
    localFileStatus: "available",
    backupStatus: video.backupStatus ?? "restored"
  };

  await writeVideos(
    videos.map((item) => (item.id === video.id ? restoredVideo : item))
  );
  return restoredVideo;
};

export const markMadeVideoCloudOnly = async (
  id: string,
  backup: Partial<MadeVideoItem> | null
) => {
  const videos = await getMadeVideos();
  const video = videos.find((item) => item.id === id);
  const downloadURL = backup?.downloadURL ?? (isRemoteUri(backup?.uri) ? backup?.uri : undefined);

  if (!video || !downloadURL) {
    return video ?? null;
  }

  const originalUri = video.uri;
  const nextVideo: MadeVideoItem = {
    ...video,
    storagePath: backup?.storagePath ?? video.storagePath,
    downloadURL,
    localUri: video.localUri ?? originalUri,
    localFileStatus: "cloud_only",
    backupStatus: "backed_up",
    uri: downloadURL
  };

  await writeVideos(videos.map((item) => (item.id === id ? nextVideo : item)));

  if (!isRemoteUri(originalUri)) {
    await FileSystem.deleteAsync(originalUri, { idempotent: true });
  }

  return nextVideo;
};

export const deleteMadeVideo = async (id: string) => {
  const videos = await getMadeVideos();
  const video = videos.find((item) => item.id === id);
  if (video?.uri && !isRemoteUri(video.uri)) {
    await FileSystem.deleteAsync(video.uri, { idempotent: true });
  }
  if (video?.coverUri && !isRemoteUri(video.coverUri)) {
    await FileSystem.deleteAsync(video.coverUri, { idempotent: true });
  }
  await writeVideos(videos.filter((video) => video.id !== id));
};
