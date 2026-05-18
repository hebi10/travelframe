import { localStorageAdapter } from "@/lib/local-storage";
import type { MadeVideoItem } from "@/types/video";

const VIDEO_STORAGE_KEY = "travel-frame.videos.v1";

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

export const getMadeVideos = async () => {
  const value = await localStorageAdapter.getItem(VIDEO_STORAGE_KEY);
  return parseVideos(value);
};

export const getMadeVideoById = async (id: string) => {
  const videos = await getMadeVideos();
  return videos.find((video) => video.id === id) ?? null;
};

export const replaceMadeVideosFromBackup = async (videos: MadeVideoItem[]) => {
  await writeVideos(videos);
  return getMadeVideos();
};

export const saveMadeVideo = async (
  video: Omit<MadeVideoItem, "id" | "createdAt" | "title"> & {
    title?: string;
  }
) => {
  const videos = await getMadeVideos();
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

export const deleteMadeVideo = async (id: string) => {
  const videos = await getMadeVideos();
  await writeVideos(videos.filter((video) => video.id !== id));
};
