import type { ImageQuality } from "@/constants/image";

export type PhotoKind = "original" | "edited";

export type PhotoRatioLabel = "Original" | "1:1" | "3:4" | "4:3" | "4:5" | "9:16" | "16:9";

export type PhotoEditTransform = {
  ratioLabel: PhotoRatioLabel;
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
  frameWidth?: number;
  frameHeight?: number;
};

export type BackupMetadata = {
  userId?: string;
  localId?: string;
  updatedAt?: string;
  backupEnabledAt?: string;
  lastBackedUpAt?: string;
  sourceDeviceId?: string;
  fileSize?: number;
  fileType?: string;
  storagePath?: string;
  downloadURL?: string;
  localUri?: string;
  localPreviewUri?: string;
  localFileStatus?: "available" | "cloud_only";
  backupStatus?: "pending" | "backed_up" | "failed" | "restored";
  imageQuality?: ImageQuality;
  optimizedQuality?: number;
  optimizedSize?: number;
  originalSize?: number;
  imageBackupSize?: number;
};

export type PhotoItem = BackupMetadata & {
  id: string;
  uri: string;
  previewUri?: string;
  createdAt: string;
  width: number;
  height: number;
  ratioLabel: string;
  kind: PhotoKind;
  edited: boolean;
  addedToVideo: boolean;
  sourcePhotoId?: string;
  edit?: PhotoEditTransform;
};

export type SaveCapturedPhotoInput = {
  uri: string;
  width?: number;
  height?: number;
  ratioLabel?: PhotoRatioLabel;
  localImageLimit?: number;
};

export type SaveEditedPhotoInput = {
  sourceUri: string;
  sourcePhotoId?: string;
  targetPhotoId?: string;
  replaceCreatedAt?: string;
  width?: number;
  height?: number;
  transform: PhotoEditTransform;
  renderedUri?: string;
  renderedWidth?: number;
  renderedHeight?: number;
  localImageLimit?: number;
};
