import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat, type Action } from "expo-image-manipulator";

import { localStorageAdapter } from "@/lib/local-storage";
import { assertLocalLibraryCapacity } from "@/lib/local-library-limit";
import { optimizeImageForStorage, resolveImageDimensions } from "@/lib/image-backup-utils";
import { applyAndroidImageAdjustment, hasCameraColorAdjustment } from "@/lib/android-image-adjustment";
import type {
  PhotoEditTransform,
  PhotoItem,
  PhotoRatioLabel,
  SaveCapturedPhotoInput,
  SaveEditedPhotoInput
} from "@/types/photo";
import { getAppSettings, getExportQualityCompression } from "@/lib/app-settings";
import { saveImageToLibrary } from "@/lib/trip-clip-export";

const PHOTO_STORAGE_KEY = "travel-frame.photos.v1";
const PHOTO_DELETION_MARKER_KEY = "travel-frame.photo-deletion-markers.v1";
const PHOTO_DIRECTORY = "photos/";
const PHOTO_PREVIEW_DIRECTORY = "photo-previews/";
const CAPTURE_DRAFT_DIRECTORY = "capture-drafts/";
const PREVIEW_MAX_EDGE = 1080;

let photoLibraryMutationChain = Promise.resolve();

const runPhotoLibraryMutation = async <T>(operation: () => Promise<T>) => {
  const run = photoLibraryMutationChain.then(operation, operation);
  photoLibraryMutationChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

const ratioPresets = [
  { label: "9:16", value: 9 / 16 },
  { label: "4:5", value: 4 / 5 },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 }
];

const createPhotoId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getPhotoDirectory = () => {
  if (!FileSystem.documentDirectory) {
    throw new Error("이 기기에서는 파일 저장소를 사용할 수 없습니다.");
  }

  return `${FileSystem.documentDirectory}${PHOTO_DIRECTORY}`;
};

const ensurePhotoDirectory = async () => {
  const directory = getPhotoDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

const getPhotoPreviewDirectory = () => {
  if (!FileSystem.documentDirectory) {
    throw new Error("이 기기에서는 파일 저장소를 사용할 수 없습니다.");
  }

  return `${FileSystem.documentDirectory}${PHOTO_PREVIEW_DIRECTORY}`;
};

const ensurePhotoPreviewDirectory = async () => {
  const directory = getPhotoPreviewDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

const getCaptureDraftDirectory = () => {
  if (!FileSystem.documentDirectory) {
    throw new Error("이 기기에서는 파일 저장소를 사용할 수 없습니다.");
  }

  return `${FileSystem.documentDirectory}${CAPTURE_DRAFT_DIRECTORY}`;
};

const ensureCaptureDraftDirectory = async () => {
  const directory = getCaptureDraftDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

const getFileExtension = (uri: string) => {
  const cleanUri = uri.split("?")[0] ?? uri;
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
};

const getRatioLabel = (width?: number, height?: number) => {
  if (!width || !height) {
    return "알 수 없음";
  }

  const ratio = width / height;
  const closest = ratioPresets.reduce((best, preset) => {
    const currentDistance = Math.abs(preset.value - ratio);
    const bestDistance = Math.abs(best.value - ratio);
    return currentDistance < bestDistance ? preset : best;
  }, ratioPresets[0]);

  if (Math.abs(closest.value - ratio) <= 0.08) {
    return closest.label;
  }

  return `${width}x${height}`;
};

const getRatioValue = (
  label: PhotoRatioLabel,
  width?: number,
  height?: number
) => {
  if (label === "Original") {
    // Original preserves the captured frame instead of applying a preset crop.
    return width && height ? width / height : undefined;
  }

  return ratioPresets.find((preset) => preset.label === label)?.value;
};

const normalizeDegrees = (radians: number) => Math.round((radians * 180) / Math.PI);

const getRotatedSize = (width: number, height: number, degrees: number) => {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized === 90 || normalized === 270) {
    return { width: height, height: width };
  }

  if (normalized !== 0 && normalized !== 180) {
    const radians = (normalized * Math.PI) / 180;
    return {
      width: Math.round(
        Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))
      ),
      height: Math.round(
        Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))
      )
    };
  }

  return { width, height };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getPreviewResize = (width?: number, height?: number) => {
  const maxEdge = Math.max(width ?? 0, height ?? 0);
  if (!maxEdge || maxEdge <= PREVIEW_MAX_EDGE) {
    return undefined;
  }

  const scale = PREVIEW_MAX_EDGE / maxEdge;
  return {
    width: width ? Math.round(width * scale) : undefined,
    height: height ? Math.round(height * scale) : undefined
  };
};

const createPhotoPreview = async ({
  sourceUri,
  id,
  width,
  height
}: {
  sourceUri: string;
  id: string;
  width?: number;
  height?: number;
}) => {
  const directory = await ensurePhotoPreviewDirectory();
  const previewUri = `${directory}${id}-preview.jpg`;
  const resize = getPreviewResize(width, height);
  const rendered = await manipulateAsync(
    sourceUri,
    resize ? [{ resize }] : [],
    {
      compress: 0.78,
      format: SaveFormat.JPEG
    }
  );

  if (rendered.uri !== previewUri) {
    await deleteLocalFile(previewUri);
  }

  await FileSystem.copyAsync({
    from: rendered.uri,
    to: previewUri
  });

  return previewUri;
};

const getCropAction = ({
  width,
  height,
  transform
}: {
  width: number;
  height: number;
  transform: PhotoEditTransform;
}): Action | null => {
  const targetRatio = getRatioValue(transform.ratioLabel, width, height);
  if (!targetRatio) {
    return null;
  }

  const sourceRatio = width / height;
  let baseWidth = width;
  let baseHeight = height;

  if (sourceRatio > targetRatio) {
    baseWidth = height * targetRatio;
  } else {
    baseHeight = width / targetRatio;
  }

  const scale = Math.max(1, transform.scale || 1);
  const cropWidth = clamp(baseWidth / scale, 1, width);
  const cropHeight = clamp(baseHeight / scale, 1, height);
  const offsetX = transform.frameWidth
    ? (transform.translateX / transform.frameWidth) * cropWidth
    : 0;
  const offsetY = transform.frameHeight
    ? (transform.translateY / transform.frameHeight) * cropHeight
    : 0;
  const centerX = width / 2 - offsetX;
  const centerY = height / 2 - offsetY;

  return {
    crop: {
      originX: Math.round(clamp(centerX - cropWidth / 2, 0, width - cropWidth)),
      originY: Math.round(clamp(centerY - cropHeight / 2, 0, height - cropHeight)),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    }
  };
};

const sortPhotos = (photos: PhotoItem[]) =>
  [...photos].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  );

const parsePhotos = (value: string | null): PhotoItem[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? sortPhotos(parsed as PhotoItem[]) : [];
  } catch {
    return [];
  }
};

const parseDeletedPhotoIds = (value: string | null) => {
  if (!value) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(value);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
        : []
    );
  } catch {
    return new Set<string>();
  }
};

const writePhotos = async (photos: PhotoItem[]) => {
  await localStorageAdapter.setItem(
    PHOTO_STORAGE_KEY,
    JSON.stringify(sortPhotos(photos))
  );
};

export const getPhotos = async () => {
  const value = await localStorageAdapter.getItem(PHOTO_STORAGE_KEY);
  return parsePhotos(value);
};

export const getDeletedPhotoIds = async () => {
  const value = await localStorageAdapter.getItem(PHOTO_DELETION_MARKER_KEY);
  return parseDeletedPhotoIds(value);
};

export const recordPhotoLocalDeletion = async (id: string) => {
  const deletedPhotoIds = await getDeletedPhotoIds();
  deletedPhotoIds.add(id);
  await localStorageAdapter.setItem(
    PHOTO_DELETION_MARKER_KEY,
    JSON.stringify([...deletedPhotoIds])
  );
};

export const wasPhotoDeletedLocally = async (id: string) =>
  (await getDeletedPhotoIds()).has(id);

export const getPhotoById = async (id: string) => {
  const photos = await getPhotos();
  const photo = photos.find((item) => item.id === id) ?? null;
  return photo ? restorePhotoOriginalIfNeeded(photo) : null;
};

export const getRecentPhoto = async () => {
  const photos = await getPhotos();
  return photos[0] ?? null;
};

export const replacePhotosFromBackup = async (photos: PhotoItem[]) => {
  await writePhotos(photos);
  return getPhotos();
};

export const createCaptureDraft = async (sourceUri: string) => {
  const id = createPhotoId();
  const extension = getFileExtension(sourceUri);
  const directory = await ensureCaptureDraftDirectory();
  const draftUri = `${directory}${id}.${extension}`;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: draftUri
  });

  return draftUri;
};

export const deleteLocalFile = async (uri?: string | null) => {
  if (!uri) {
    return;
  }

  if (isRemoteUri(uri)) {
    return;
  }

  await FileSystem.deleteAsync(uri, { idempotent: true });
};

const isRemoteUri = (uri?: string | null) =>
  typeof uri === "string" && /^https?:\/\//i.test(uri);

export const restorePhotoOriginalIfNeeded = async (photo: PhotoItem) => {
  if (photo.localFileStatus !== "cloud_only") {
    return photo;
  }

  const sourceUri = photo.downloadURL ?? (isRemoteUri(photo.uri) ? photo.uri : null);
  if (!sourceUri) {
    return photo;
  }

  const directory = await ensurePhotoDirectory();
  const destinationUri = `${directory}${photo.id}-restored.jpg`;
  const result = await FileSystem.downloadAsync(sourceUri, destinationUri);
  const photos = await getPhotos();
  const restoredPhoto: PhotoItem = {
    ...photo,
    uri: result.uri,
    localUri: result.uri,
    localFileStatus: "available",
    backupStatus: photo.backupStatus ?? "restored"
  };

  await writePhotos(
    photos.map((item) => (item.id === photo.id ? restoredPhoto : item))
  );
  return restoredPhoto;
};

export const markPhotoCloudOnly = async (
  id: string,
  backup: Partial<PhotoItem> | null
) => {
  const photos = await getPhotos();
  const photo = photos.find((item) => item.id === id);
  const downloadURL = backup?.downloadURL ?? (isRemoteUri(backup?.uri) ? backup?.uri : undefined);

  if (!photo || !downloadURL) {
    return photo ?? null;
  }

  const originalUri = photo.uri;
  const nextPhoto: PhotoItem = {
    ...photo,
    storagePath: backup?.storagePath ?? photo.storagePath,
    downloadURL,
    localUri: photo.localUri ?? originalUri,
    localPreviewUri: photo.localPreviewUri ?? photo.previewUri,
    localFileStatus: "cloud_only",
    backupStatus: "backed_up",
    uri: downloadURL,
    previewUri: photo.previewUri ?? backup?.previewUri
  };

  await writePhotos(photos.map((item) => (item.id === id ? nextPhoto : item)));

  if (!isRemoteUri(originalUri) && originalUri !== photo.previewUri) {
    await deleteLocalFile(originalUri);
  }

  return nextPhoto;
};

const normalizeCapturedPhotoForRatio = async ({
  uri,
  width,
  height
}: {
  uri: string;
  width?: number;
  height?: number;
}) => {
  const normalized = await manipulateAsync(uri, [], {
    compress: 1,
    format: SaveFormat.JPEG
  });
  const dimensions =
    normalized.width && normalized.height
      ? { width: normalized.width, height: normalized.height }
      : await resolveImageDimensions({
          uri: normalized.uri,
          width,
          height
        });

  return {
    uri: normalized.uri,
    width: dimensions?.width ?? width ?? 0,
    height: dimensions?.height ?? height ?? 0,
    temporaryUris: normalized.uri !== uri ? [normalized.uri] : []
  };
};

const renderCapturedPhotoForSave = async ({
  uri,
  width,
  height,
  ratioLabel = "Original"
}: SaveCapturedPhotoInput) => {
  const shouldApplyRatio = ratioLabel !== "Original";
  const capturedDimensions = await resolveImageDimensions({ uri, width, height });
  const normalizedSource = await normalizeCapturedPhotoForRatio({
    uri,
    width: capturedDimensions?.width ?? width,
    height: capturedDimensions?.height ?? height
  });

  if (shouldApplyRatio) {
    const rendered = await renderEditedPhotoFromTransform({
      sourceUri: normalizedSource.uri,
      width: normalizedSource.width,
      height: normalizedSource.height,
      transform: {
        ratioLabel,
        translateX: 0,
        translateY: 0,
        scale: 1,
        rotation: 0
      }
    });

    return {
      ...rendered,
      temporaryUris: [
        ...normalizedSource.temporaryUris
      ]
    };
  }

  return {
    uri: normalizedSource.uri,
    width: normalizedSource.width,
    height: normalizedSource.height,
    temporaryUris: normalizedSource.temporaryUris
  };
};

const deleteTemporaryFiles = async (uris: string[]) => {
  await Promise.all(uris.map((uri) => deleteLocalFile(uri)));
};

const prepareCapturedPhotoForStorage = async (input: SaveCapturedPhotoInput) => {
  const rendered = await renderCapturedPhotoForSave(input);
  const temporaryUris = [...rendered.temporaryUris];
  let adjusted: { uri: string; width?: number; height?: number } = {
    uri: rendered.uri,
    width: rendered.width,
    height: rendered.height
  };
  if (hasCameraColorAdjustment(input.colorAdjustment)) {
    adjusted = await applyAndroidImageAdjustment({
        uri: rendered.uri,
        adjustment: input.colorAdjustment
      });
  }
  if (adjusted.uri !== rendered.uri && adjusted.uri !== input.uri) {
    temporaryUris.push(adjusted.uri);
  }
  const settings = await getAppSettings();
  const optimized = await optimizeImageForStorage({
    uri: adjusted.uri,
    width: adjusted.width ?? rendered.width,
    height: adjusted.height ?? rendered.height,
    imageQuality: settings.imageBackupQuality
  });
  const allTemporaryUris = [
    ...temporaryUris,
    rendered.uri !== input.uri ? rendered.uri : null,
    optimized.uri !== adjusted.uri && optimized.uri !== input.uri ? optimized.uri : null
  ].filter((uri): uri is string => Boolean(uri));

  return {
    ...optimized,
    width: optimized.width ?? adjusted.width ?? rendered.width,
    height: optimized.height ?? adjusted.height ?? rendered.height,
    temporaryUris: allTemporaryUris
  };
};

export const saveCapturedPhotoToDevice = async (
  input: SaveCapturedPhotoInput,
  preparedUri?: string
) => {
  if (preparedUri) {
    return await saveImageToLibrary(preparedUri);
  }

  const prepared = await prepareCapturedPhotoForStorage(input);

  try {
    return await saveImageToLibrary(prepared.uri);
  } finally {
    await deleteTemporaryFiles(prepared.temporaryUris);
  }
};

export const saveCapturedPhoto = async ({
  uri,
  width,
  height,
  ratioLabel = "Original",
  localImageLimit
}: SaveCapturedPhotoInput) => {
  return runPhotoLibraryMutation(async () => {
  const photos = await getPhotos();
  assertLocalLibraryCapacity({
    currentCount: photos.length,
    limit: localImageLimit,
    label: "이미지"
  });
  const id = createPhotoId();
  const shouldApplyRatio = ratioLabel !== "Original";
  const extension = "jpg";
  const directory = await ensurePhotoDirectory();
  const destinationUri = `${directory}${id}.${extension}`;
  const prepared = await prepareCapturedPhotoForStorage({
    uri,
    width,
    height,
    ratioLabel
  });

  try {
    await FileSystem.copyAsync({
      from: prepared.uri,
      to: destinationUri
    });

    const previewUri = await createPhotoPreview({
      sourceUri: destinationUri,
      id,
      width: prepared.width,
      height: prepared.height
    });

    const photo: PhotoItem = {
      id,
      uri: destinationUri,
      previewUri,
      createdAt: new Date().toISOString(),
      width: prepared.width ?? 0,
      height: prepared.height ?? 0,
      ratioLabel: shouldApplyRatio
        ? ratioLabel
        : getRatioLabel(prepared.width, prepared.height),
      kind: "original",
      edited: false,
      addedToVideo: false,
      imageQuality: prepared.imageQuality,
      optimizedQuality: prepared.quality,
      optimizedSize: prepared.size,
      originalSize: prepared.originalSize
    };

    await writePhotos([photo, ...photos]);
    return photo;
  } finally {
    await deleteTemporaryFiles(prepared.temporaryUris);
  }
  });
};

export const saveEditedPhoto = async ({
  sourceUri,
  sourcePhotoId,
  targetPhotoId,
  replaceCreatedAt,
  width,
  height,
  transform,
  renderedUri,
  renderedWidth,
  renderedHeight,
  localImageLimit
}: SaveEditedPhotoInput) => {
  const photos = await getPhotos();
  const existingPhoto = targetPhotoId
    ? photos.find((photo) => photo.id === targetPhotoId)
    : null;
  if (!existingPhoto) {
    assertLocalLibraryCapacity({
      currentCount: photos.length,
      limit: localImageLimit,
      label: "이미지"
    });
  }
  const id = targetPhotoId ?? createPhotoId();
  const directory = await ensurePhotoDirectory();
  const destinationUri = `${directory}${id}-edited.jpg`;
  const rendered = renderedUri
    ? {
        uri: renderedUri,
        width: renderedWidth ?? width ?? 0,
        height: renderedHeight ?? height ?? 0
      }
    : await renderEditedPhotoFromTransform({
        sourceUri,
        width,
        height,
        transform
      });
  const prepared = await prepareEditedPhotoForStorage({
    rendered,
    sourceUri,
    preserveRenderedUri: Boolean(renderedUri)
  });

  if (targetPhotoId && prepared.uri !== destinationUri) {
    await deleteLocalFile(destinationUri);
  }

  try {
    await FileSystem.copyAsync({
      from: prepared.uri,
      to: destinationUri
    });

    const previewUri = await createPhotoPreview({
      sourceUri: destinationUri,
      id,
      width: prepared.width,
      height: prepared.height
    });

    const photo: PhotoItem = {
      id,
      uri: destinationUri,
      previewUri,
      createdAt: replaceCreatedAt ?? existingPhoto?.createdAt ?? new Date().toISOString(),
      width: prepared.width ?? 0,
      height: prepared.height ?? 0,
      ratioLabel:
        transform.ratioLabel === "Original"
          ? getRatioLabel(prepared.width, prepared.height)
          : transform.ratioLabel,
      kind: "edited",
      edited: true,
      addedToVideo: existingPhoto?.addedToVideo ?? false,
      sourcePhotoId: sourcePhotoId ?? existingPhoto?.sourcePhotoId,
      edit: transform,
      imageQuality: prepared.imageQuality,
      optimizedQuality: prepared.quality,
      optimizedSize: prepared.size,
      originalSize: prepared.originalSize
    };

    const nextPhotos =
      targetPhotoId && existingPhoto
        ? photos.map((item) => (item.id === targetPhotoId ? photo : item))
        : [photo, ...photos];

    if (existingPhoto?.uri && existingPhoto.uri !== destinationUri) {
      await deleteLocalFile(existingPhoto.uri);
    }

    if (existingPhoto?.previewUri && existingPhoto.previewUri !== previewUri) {
      await deleteLocalFile(existingPhoto.previewUri);
    }

    await writePhotos(nextPhotos);
    return photo;
  } finally {
    await deleteTemporaryFiles(prepared.temporaryUris);
  }
};

const prepareEditedPhotoForStorage = async ({
  rendered,
  sourceUri,
  preserveRenderedUri
}: {
  rendered: { uri: string; width: number; height: number };
  sourceUri: string;
  preserveRenderedUri: boolean;
}) => {
  const settings = await getAppSettings();
  const optimized = await optimizeImageForStorage({
    uri: rendered.uri,
    width: rendered.width,
    height: rendered.height,
    imageQuality: settings.imageBackupQuality
  });
  const temporaryUris = [
    !preserveRenderedUri && rendered.uri !== sourceUri ? rendered.uri : null,
    optimized.uri !== rendered.uri && optimized.uri !== sourceUri ? optimized.uri : null
  ].filter((uri): uri is string => Boolean(uri));

  return {
    ...optimized,
    width: optimized.width ?? rendered.width,
    height: optimized.height ?? rendered.height,
    temporaryUris
  };
};

const renderEditedPhotoFromTransform = async ({
  sourceUri,
  width,
  height,
  transform
}: {
  sourceUri: string;
  width?: number;
  height?: number;
  transform: PhotoEditTransform;
}) => {
  const rotateDegrees = normalizeDegrees(transform.rotation);
  const safeWidth = width ?? 1;
  const safeHeight = height ?? 1;
  const rotatedSize = getRotatedSize(safeWidth, safeHeight, rotateDegrees);
  const actions: Action[] = [];

  if (rotateDegrees !== 0) {
    actions.push({ rotate: rotateDegrees });
  }

  const cropAction = getCropAction({
    width: rotatedSize.width,
    height: rotatedSize.height,
    transform
  });

  if (cropAction) {
    actions.push(cropAction);
  }

  const settings = await getAppSettings();
  return manipulateAsync(sourceUri, actions, {
    compress: getExportQualityCompression(settings.exportQuality),
    format: SaveFormat.JPEG
  });
};

export const deletePhoto = async (id: string) => {
  await recordPhotoLocalDeletion(id);
  const photos = await getPhotos();
  const photo = photos.find((item) => item.id === id);

  if (photo) {
    await deleteLocalFile(photo.uri);
    if (photo.previewUri) {
      await deleteLocalFile(photo.previewUri);
    }
  }

  await writePhotos(photos.filter((item) => item.id !== id));
};

export const togglePhotoForVideo = async (id: string) => {
  const photos = await getPhotos();
  let updatedPhoto: PhotoItem | null = null;
  const nextPhotos = photos.map((photo) => {
    if (photo.id !== id) {
      return photo;
    }

    updatedPhoto = {
      ...photo,
      addedToVideo: !photo.addedToVideo
    };
    return updatedPhoto;
  });

  await writePhotos(nextPhotos);
  return updatedPhoto;
};

export const ensurePhotoPreviews = async (photos: PhotoItem[]) => {
  let changed = false;
  const nextPhotos = await Promise.all(
    photos.map(async (photo) => {
      if (photo.previewUri) {
        return photo;
      }

      try {
        const previewUri = await createPhotoPreview({
          sourceUri: photo.uri,
          id: photo.id,
          width: photo.width,
          height: photo.height
        });
        changed = true;
        return {
          ...photo,
          previewUri
        };
      } catch {
        return photo;
      }
    })
  );

  if (changed) {
    await writePhotos(nextPhotos);
  }

  return sortPhotos(nextPhotos);
};
