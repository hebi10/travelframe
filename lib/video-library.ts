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

const validRatios = new Set(["1:1", "3:4", "4:5", "9:16", "16:9"]);
const validTemplates = new Set(["minimal", "film-log", "center-cut", "reel-basic"]);
const validTransitions = new Set(["fade", "zoom", "slide", "none"]);

const normalizeText = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const normalizeFiniteNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const normalizeDate = (value: unknown) => {
  if (typeof value !== "string") {
    return new Date(0).toISOString();
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? value : new Date(0).toISOString();
};

const normalizeVideoDurations = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1])
    )
  );
};

const normalizeMadeVideoItem = (
  video: Partial<MadeVideoItem> & Record<string, unknown>,
  index: number
): MadeVideoItem => ({
  ...video,
  id: normalizeText(video.id, `stored-video-${index + 1}`),
  uri: normalizeText(video.uri, ""),
  coverUri:
    typeof video.coverUri === "string" && video.coverUri.length > 0
      ? video.coverUri
      : undefined,
  createdAt: normalizeDate(video.createdAt),
  title: normalizeText(video.title, `여행 클립 ${index + 1}`),
  ratio: validRatios.has(video.ratio ?? "") ? video.ratio! : "9:16",
  template: validTemplates.has(video.template ?? "") ? video.template! : "minimal",
  transition: validTransitions.has(video.transition ?? "") ? video.transition! : "fade",
  transitionDuration: normalizeFiniteNumber(video.transitionDuration, 0.45),
  duration: normalizeFiniteNumber(video.duration, 0),
  photoIds: normalizeStringArray(video.photoIds),
  durations: normalizeVideoDurations(video.durations),
  musicId: normalizeText(video.musicId, "none") as MadeVideoItem["musicId"],
  musicLabel: normalizeText(video.musicLabel, "무음"),
  storagePath: typeof video.storagePath === "string" ? video.storagePath : undefined,
  downloadURL: typeof video.downloadURL === "string" ? video.downloadURL : undefined,
  localUri: typeof video.localUri === "string" ? video.localUri : undefined,
  localFileStatus:
    video.localFileStatus === "available" || video.localFileStatus === "cloud_only"
      ? video.localFileStatus
      : undefined,
  backupStatus:
    video.backupStatus === "pending" ||
    video.backupStatus === "backed_up" ||
    video.backupStatus === "failed" ||
    video.backupStatus === "restored"
      ? video.backupStatus
      : undefined
});

const parseVideos = (value: string | null): MadeVideoItem[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? sortVideos(parsed.map(normalizeMadeVideoItem)) : [];
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
