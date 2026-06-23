import type { CloudBackupOverview } from "@/lib/cloud-backup";
import type { PhotoItem } from "@/types/photo";
import type { MadeVideoItem } from "@/types/video";
import type { ImageBundleWorkItem } from "@/types/work";

export type StudioTab = "photos" | "videos" | "works";
export type PageSize = 6 | 10 | 20;
export type StudioWorkItem =
  | { kind: "single-image"; item: PhotoItem; createdAt: string }
  | { kind: "image-bundle"; item: ImageBundleWorkItem; createdAt: string }
  | { kind: "video"; item: MadeVideoItem; createdAt: string };

export type ImportProgress = {
  percent: number;
  detail: string;
};

export type DeleteProgress = {
  title: string;
  detail: string;
};

export const tabs: { label: string; value: StudioTab }[] = [
  { label: "사진", value: "photos" },
  { label: "동영상", value: "videos" },
  { label: "작업물", value: "works" }
];

export const PAGE_SIZE_OPTIONS: PageSize[] = [6, 10, 20];
export const initialBackupOverview: CloudBackupOverview = {
  photoCount: 0,
  imageBundleCount: 0,
  videoCount: 0,
  imageBackupBytes: 0,
  deleteAfter: null,
  status: "none",
  backedUpAt: null,
  deletedAt: null
};

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

export const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
};

export const isSyncedPhoto = (photo: PhotoItem) =>
  photo.backupStatus === "backed_up" ||
  photo.localFileStatus === "cloud_only" ||
  Boolean(photo.storagePath) ||
  Boolean(photo.downloadURL);
