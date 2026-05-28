import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Image } from "react-native";

import {
  DEFAULT_IMAGE_QUALITY,
  IMAGE_QUALITY_OPTIONS,
  IMAGE_OPTIMIZATION_FAILED_MESSAGE,
  MAX_TOTAL_IMAGE_BACKUP_SIZE_BYTES,
  type ImageQuality
} from "@/constants/image";

export type OptimizedBackupImage = {
  uri: string;
  width: number | null;
  height: number | null;
  size: number;
  quality: number;
  imageQuality: ImageQuality;
  originalSize: number;
};

export const getImageQualityOption = (imageQuality: ImageQuality) =>
  IMAGE_QUALITY_OPTIONS.find((option) => option.value === imageQuality) ??
  IMAGE_QUALITY_OPTIONS.find((option) => option.value === DEFAULT_IMAGE_QUALITY) ??
  IMAGE_QUALITY_OPTIONS[0];

export const getImageResizeAction = ({
  width,
  height,
  maxLongSide
}: {
  width?: number | null;
  height?: number | null;
  maxLongSide: number;
}) => {
  if (!width || !height || width <= 0 || height <= 0) {
    return undefined;
  }

  const longSide = Math.max(width, height);
  if (longSide <= maxLongSide) {
    return undefined;
  }

  const scale = maxLongSide / longSide;
  return {
    resize: {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    }
  };
};

export const resolveImageDimensions = async ({
  uri,
  width,
  height
}: {
  uri: string;
  width?: number | null;
  height?: number | null;
}) => {
  if (width && height && width > 0 && height > 0) {
    return { width, height };
  }

  return new Promise<{ width: number; height: number } | null>((resolve) => {
    Image.getSize(
      uri,
      (resolvedWidth, resolvedHeight) => {
        if (resolvedWidth > 0 && resolvedHeight > 0) {
          resolve({ width: resolvedWidth, height: resolvedHeight });
          return;
        }

        resolve(null);
      },
      () => resolve(null)
    );
  });
};

const isRemoteUri = (uri: string) => /^https?:\/\//i.test(uri);

const getLocalFileSize = async (uri: string) => {
  if (isRemoteUri(uri)) {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  }

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || !("size" in info) || typeof info.size !== "number") {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  }

  return info.size;
};

export const optimizeImageForStorage = async ({
  uri,
  width,
  height,
  imageQuality,
  sourceImageQuality
}: {
  uri: string;
  width?: number | null;
  height?: number | null;
  imageQuality: ImageQuality;
  sourceImageQuality?: ImageQuality | null;
}): Promise<OptimizedBackupImage> => {
  try {
    const option = getImageQualityOption(imageQuality);
    const originalSize = await getLocalFileSize(uri);
    const dimensions = await resolveImageDimensions({ uri, width, height });
    const resizeAction = getImageResizeAction({
      width: dimensions?.width,
      height: dimensions?.height,
      maxLongSide: option.maxLongSide
    });
    const canReuseSource =
      sourceImageQuality === option.value &&
      !resizeAction &&
      Boolean(dimensions?.width && dimensions.height);

    if (canReuseSource) {
      return {
        uri,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        size: originalSize,
        quality: option.quality,
        imageQuality: option.value,
        originalSize
      };
    }

    const result = await manipulateAsync(
      uri,
      resizeAction ? [resizeAction] : [],
      {
        compress: option.quality,
        format: SaveFormat.JPEG
      }
    );
    const size = await getLocalFileSize(result.uri);

    return {
      uri: result.uri,
      width: result.width ?? null,
      height: result.height ?? null,
      size,
      quality: option.quality,
      imageQuality: option.value,
      originalSize
    };
  } catch {
    throw new Error(IMAGE_OPTIMIZATION_FAILED_MESSAGE);
  }
};

export const optimizeImageForBackup = optimizeImageForStorage;

export const calculateCombinedImageBackupSize = (
  currentSize: number,
  newSizes: number[]
) =>
  Math.max(0, currentSize) +
  newSizes.reduce((sum, size) => sum + Math.max(0, size), 0);

export const isImageBackupSizeExceeded = (
  size: number,
  limit = MAX_TOTAL_IMAGE_BACKUP_SIZE_BYTES
) => size > limit;

export const formatImageBackupSize = (bytes: number) => {
  const safeBytes = Math.max(0, bytes);
  const mb = safeBytes / (1024 * 1024);
  if (mb < 1024) {
    return `${Math.round(mb)}MB`;
  }

  const gb = mb / 1024;
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1)}GB`;
};

const formatStorageUsagePercent = (usedBytes: number, limitBytes: number) => {
  if (limitBytes <= 0) {
    return "0%";
  }

  const percent = (Math.max(0, usedBytes) / limitBytes) * 100;
  if (percent === 0) {
    return "0%";
  }

  if (Number.isInteger(percent)) {
    return `${percent}%`;
  }

  return `${percent.toFixed(1)}%`;
};

export const formatBackupStorageUsage = (usedBytes: number, limitBytes: number) => {
  if (limitBytes <= 0) {
    return "사용 불가";
  }

  return `${formatImageBackupSize(usedBytes)} / ${formatImageBackupSize(limitBytes)} (${formatStorageUsagePercent(usedBytes, limitBytes)})`;
};

export const formatImageBackupUsage = (
  bytes: number,
  limitBytes = MAX_TOTAL_IMAGE_BACKUP_SIZE_BYTES
) => `서버 백업 용량 ${formatBackupStorageUsage(bytes, limitBytes)}`;
