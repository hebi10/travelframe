import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat, type Action } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { type ImageQuality } from "@/constants/image";
import {
  getImageQualityOption,
  getImageResizeAction
} from "@/lib/image-backup-utils";
import {
  getTripClipImageExportActions,
  type TripClipImageAdjustment
} from "@/lib/trip-clip-image-export";
import {
  assertCanSaveToMediaLibrary,
  MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE
} from "./media-library-availability";
import {
  getMediaLibraryAccessState,
  getMediaLibraryPermissionMessage
} from "@/lib/media-library-permissions";

type MediaLibraryModule = typeof import("expo-media-library");
type MediaPermissionKind = "photo" | "video";
export type ImageSaveFormat = "original" | "png" | "jpeg";
type ImageExportOptions = {
  imageQuality?: ImageQuality;
  width?: number | null;
  height?: number | null;
  frameAspectRatio?: number | null;
  adjustment?: TripClipImageAdjustment | null;
  frameWidth?: number | null;
  frameHeight?: number | null;
};
let androidDownloadDirectoryUri: string | null = null;
const TRIP_CLIP_ANDROID_DOWNLOAD_FOLDER = "TravelFrame";
const TRIP_CLIP_MEDIA_ALBUM = "트래블프레임";

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

const requestSavePermission = async (kind: MediaPermissionKind) => {
  const MediaLibrary = await getMediaLibrary();
  const permission =
    Platform.OS === "android"
      ? await MediaLibrary.requestPermissionsAsync(false, [kind])
      : await MediaLibrary.requestPermissionsAsync(false);
  const state = getMediaLibraryAccessState(permission);

  const permissionMessage = getMediaLibraryPermissionMessage(
    state,
    "핸드폰 앨범 저장 권한이 필요합니다."
  );

  if (!permission.granted) {
    throw new Error(permissionMessage);
  }

  if (state !== "full") {
    throw new Error(permissionMessage);
  }

  return MediaLibrary;
};

const getAndroidExportDirectoryUri = async (parentDirectoryUri: string) => {
  try {
    return await FileSystem.StorageAccessFramework.makeDirectoryAsync(
      parentDirectoryUri,
      TRIP_CLIP_ANDROID_DOWNLOAD_FOLDER
    );
  } catch {
    try {
      const children = await FileSystem.StorageAccessFramework.readDirectoryAsync(
        parentDirectoryUri
      );
      const existingDirectoryUri = children.find((uri) =>
        decodeURIComponent(uri).includes(TRIP_CLIP_ANDROID_DOWNLOAD_FOLDER)
      );

      if (existingDirectoryUri) {
        return existingDirectoryUri;
      }
    } catch {
      // Fall back to the selected directory if SAF cannot enumerate children.
    }
  }

  return parentDirectoryUri;
};

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

  const exportDirectoryUri = await getAndroidExportDirectoryUri(permission.directoryUri);
  androidDownloadDirectoryUri = exportDirectoryUri;
  return exportDirectoryUri;
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

const getImageSaveFormat = (uri: string, format: ImageSaveFormat) => {
  const mimeType = getImageSaveMimeType(uri, format);

  if (mimeType === "image/png") {
    return SaveFormat.PNG;
  }

  if (mimeType === "image/webp") {
    return SaveFormat.WEBP;
  }

  return SaveFormat.JPEG;
};

const saveImageToAndroidDownload = async (
  uri: string,
  format: ImageSaveFormat,
  options: ImageExportOptions = {}
) => {
  const saveUri = await prepareImageForLibrarySave(uri, format, options);
  const mimeType = getImageSaveMimeType(saveUri, format);
  return saveFileToAndroidDownload(saveUri, mimeType, "travel-frame");
};

const saveVideoToAndroidDownload = async (uri: string) =>
  saveFileToAndroidDownload(uri, "video/mp4", "travel-frame-video");

const saveFileToAndroidDownload = async (
  uri: string,
  mimeType: string,
  fileNamePrefix: string
) => {
  const directoryUri = await getAndroidDownloadDirectoryUri();
  const fileName = `${fileNamePrefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    fileName,
    mimeType
  );
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });

  await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, base64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return targetUri;
};

const saveImageToAndroidAlbum = async (
  uri: string,
  format: ImageSaveFormat,
  options: ImageExportOptions = {}
) => {
  const MediaLibrary = await requestSavePermission("photo");
  assertCanSaveToMediaLibrary(MediaLibrary);

  const saveUri = await prepareImageForLibrarySave(uri, format, options);
  const album = await MediaLibrary.getAlbumAsync(TRIP_CLIP_MEDIA_ALBUM);

  if (album) {
    await MediaLibrary.createAssetAsync(saveUri, album);
  } else {
    await MediaLibrary.createAlbumAsync(TRIP_CLIP_MEDIA_ALBUM, undefined, true, saveUri);
  }

  return saveUri;
};

export const prepareImageForLibrarySave = async (
  uri: string,
  format: ImageSaveFormat,
  options: ImageExportOptions = {}
) => {
  const qualityOption = options.imageQuality
    ? getImageQualityOption(options.imageQuality)
    : null;
  const cropActions = getTripClipImageExportActions({
    width: options.width,
    height: options.height,
    frameAspectRatio: options.frameAspectRatio,
    adjustment: options.adjustment,
    frameWidth: options.frameWidth,
    frameHeight: options.frameHeight
  }) as Action[];
  const cropAction = cropActions.find(
    (action): action is Extract<Action, { crop: unknown }> => "crop" in action
  );
  const resizeAction = qualityOption
    ? getImageResizeAction({
        width: cropAction?.crop.width ?? options.width,
        height: cropAction?.crop.height ?? options.height,
        maxLongSide: qualityOption.maxLongSide
      })
    : undefined;
  const actions = resizeAction ? [...cropActions, resizeAction] : cropActions;

  if (format === "original" && actions.length === 0 && !qualityOption) {
    return uri;
  }

  const rendered = await manipulateAsync(
    uri,
    actions,
    getImageSaveFormat(uri, format) === SaveFormat.PNG
      ? { format: SaveFormat.PNG }
      : {
          compress: qualityOption?.quality ?? 1,
          format: getImageSaveFormat(uri, format)
        }
  );

  return rendered.uri;
};

export const saveVideoToLibrary = async (uri: string) => {
  try {
    if (Platform.OS === "android") {
      return await saveVideoToAndroidDownload(uri);
    }

    const MediaLibrary = await requestSavePermission("video");
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
      try {
        return await saveImageToAndroidAlbum(uri, format, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "");

        if (
          message.includes(MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE) ||
          message.includes("Expo Go can no longer provide full access") ||
          message.includes("requestPermissionsAsync has been rejected")
        ) {
          return await saveImageToAndroidDownload(uri, format, options);
        }

        throw error;
      }
    }

    const MediaLibrary = await requestSavePermission("photo");
    const saveUri = await prepareImageForLibrarySave(uri, format, options);
    assertCanSaveToMediaLibrary(MediaLibrary);
    await MediaLibrary.saveToLibraryAsync(saveUri);
    return saveUri;
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
      "앨범 저장 권한이 제한되어 있습니다. 공유 기능으로 저장하거나 앱을 최신 버전으로 업데이트해 주세요."
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
