import type { CloudBackupOverview } from "@/lib/cloud-backup";

export type UsageStats = {
  photos: number;
  imageBundles: number;
  videos: number;
};

export const emptyBackupOverview: CloudBackupOverview = {
  photoCount: 0,
  imageBundleCount: 0,
  videoCount: 0,
  imageBackupBytes: 0,
  deleteAfter: null,
  status: "none",
  backedUpAt: null,
  deletedAt: null
};

export const emptyUsageStats: UsageStats = {
  photos: 0,
  imageBundles: 0,
  videos: 0
};
