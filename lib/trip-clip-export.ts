import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { type ImageQuality } from "@/constants/image";
import {
  getImageQualityOption,
  getImageResizeAction
} from "@/lib/image-backup-utils";
import {
  assertCanSaveToMediaLibrary,
  MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE
} from "./media-library-availability";

type MediaLibraryModule = typeof import("expo-media-library");
type MediaPermissionKind = "photo" | "video";
export type ImageSaveFormat = "original" | "png" | "jpeg";
type ImageExportOptions = {
  imageQuality?: ImageQuality;
  width?: number | null;
  height?: number | null;
};
let androidDownloadDirectoryUri: string | null = null;

const getMediaLibrary = async (): Promise<MediaLibraryModule> =>
  import("expo-media-library");

const getMimeType = (uri: string) => {
  const cleanUri = uri.split("?")[0]?.toLowerCase() ?? uri.toLowerCase();

  if (cleanUri.endsWith(".png")) {
    return "image/png";
  }

  if (cleanUri.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
};

const requestSavePermission = async (_kind: MediaPermissionKind) => getMediaLibrary();

const getAndroidDownloadDirectoryUri = async () => {
  if (androidDownloadDirectoryUri) {
    return androidDownloadDirectoryUri;
  }

  const initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot("Download");
  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);

  if (!permission.granted) {
    throw new Error("다운로드 폴더에 저장하려면 폴더 접근 권한이 필요합니다.");
  }

  androidDownloadDirectoryUri = permission.directoryUri;
  return permission.directoryUri;
};

const getImageSaveMimeType = (uri: string, format: ImageSaveFormat) => {
  if (format === "png") {
    return "image/png";
  }

  if (format === "jpeg") {
    return "image/jpeg";
  }

  return getMimeType(uri);
};

const getImageSaveExtension = (mimeType: string) => {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
};

const saveImageToAndroidDownload = async (
  uri: string,
  format: ImageSaveFormat,
  options: ImageExportOptions = {}
) => {
  const saveUri = await prepareImageForLibrarySave(uri, format, options);
  const mimeType = getImageSaveMimeType(saveUri, format);
  const extension = getImageSaveExtension(mimeType);
  const directoryUri = await getAndroidDownloadDirectoryUri();
  const fileName = `travel-frame-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    fileName,
    mimeType
  );
  const base64 = await FileSystem.readAsStringAsync(saveUri, {
    encoding: FileSystem.EncodingType.Base64
  });

  await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, base64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return `${fileName}.${extension}`;
};

export const prepareImageForLibrarySave = async (
  uri: string,
  format: ImageSaveFormat,
  options: ImageExportOptions = {}
) => {
  if (format === "original") {
    return uri;
  }

  const qualityOption = options.imageQuality
    ? getImageQualityOption(options.imageQuality)
    : null;
  const resizeAction = qualityOption
    ? getImageResizeAction({
        width: options.width,
        height: options.height,
        maxLongSide: qualityOption.maxLongSide
      })
    : undefined;

  const rendered = await manipulateAsync(
    uri,
    resizeAction ? [resizeAction] : [],
    format === "png"
      ? { format: SaveFormat.PNG }
      : {
          compress: qualityOption?.quality ?? 1,
          format: SaveFormat.JPEG
        }
  );

  return rendered.uri;
};

export const saveVideoToLibrary = async (uri: string) => {
  const MediaLibrary = await requestSavePermission("video");
  try {
    assertCanSaveToMediaLibrary(MediaLibrary);
    await MediaLibrary.saveToLibraryAsync(uri);
  } catch (error) {
    throw normalizeMediaSaveError(error, "영상을 핸드폰 앨범에 저장하지 못했습니다.");
  }
};

export const saveImageToLibrary = async (
  uri: string,
  format: ImageSaveFormat = "original",
  options: ImageExportOptions = {}
) => {
  try {
    if (Platform.OS === "android") {
      await saveImageToAndroidDownload(uri, format, options);
      return;
    }

    const MediaLibrary = await requestSavePermission("photo");
    const saveUri = await prepareImageForLibrarySave(uri, format, options);
    assertCanSaveToMediaLibrary(MediaLibrary);
    await MediaLibrary.saveToLibraryAsync(saveUri);
  } catch (error) {
    throw normalizeMediaSaveError(error, "이미지를 핸드폰 앨범에 저장하지 못했습니다.");
  }
};

const normalizeMediaSaveError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (
    message.includes("Expo Go can no longer provide full access") ||
    message.includes("requestPermissionsAsync has been rejected")
  ) {
    return new Error(
      "Expo Go Android에서는 앨범 저장 권한이 제한될 수 있습니다. 개발 빌드에서 테스트하거나 공유 기능으로 저장해 주세요."
    );
  }

  if (
    message.includes(MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE) ||
    message.includes("saveToLibraryAsync is not a function")
  ) {
    return new Error(MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE);
  }

  if (message.includes("permission") || message.includes("Permission")) {
    return new Error("핸드폰 앨범 저장 권한이 필요합니다.");
  }

  return error instanceof Error ? error : new Error(fallback);
};

export const shareVideo = async (uri: string) => {
  const available = await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error("이 기기에서는 공유 기능을 사용할 수 없습니다.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "video/mp4",
    dialogTitle: "여행 클립 공유"
  });
};

export const shareImage = async (
  uri: string,
  format: ImageSaveFormat = "original",
  options: ImageExportOptions = {}
) => {
  const available = await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error("이 기기에서는 공유 기능을 사용할 수 없습니다.");
  }

  const shareUri = await prepareImageForLibrarySave(uri, format, options);

  await Sharing.shareAsync(shareUri, {
    mimeType: getImageSaveMimeType(shareUri, format),
    dialogTitle: "대표 이미지 공유"
  });
};
