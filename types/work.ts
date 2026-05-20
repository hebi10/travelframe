import type { TripClipRatio } from "@/constants/trip-clip";
import type { BackupMetadata } from "@/types/photo";

export type ImageBundleWorkItem = BackupMetadata & {
  id: string;
  kind: "image-bundle";
  title: string;
  createdAt: string;
  coverUri?: string;
  ratio: TripClipRatio;
  photoIds: string[];
  imageUris: string[];
  localImageUris?: string[];
  imageWidths?: (number | null)[];
  imageHeights?: (number | null)[];
};
