import * as FileSystem from "expo-file-system/legacy";

import { assertLocalLibraryCapacity } from "@/lib/local-library-limit";
import {
  createLocalLibraryId,
  isRemoteUri,
  readStoredItems,
  readStoredStringSet,
  writeSortedItems,
  writeStoredStringSet
} from "@/lib/local-library-store";
import { getNextTripClipTitle, TRIP_CLIP_TITLE_PREFIX } from "@/lib/trip-clip-title";
import type { ImageBundleWorkItem } from "@/types/work";

const IMAGE_BUNDLE_STORAGE_KEY = "travel-frame.image-bundles.v1";
const IMAGE_BUNDLE_DELETION_MARKER_KEY = "travel-frame.image-bundle-deletion-markers.v1";
const IMAGE_BUNDLE_DIRECTORY = "image-bundles/";

const sortImageBundles = (items: ImageBundleWorkItem[]) =>
  [...items].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  );

const validRatios = new Set(["1:1", "3:4", "4:5", "9:16", "16:9"]);

const normalizeText = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const normalizeNullableNumberArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "number" && Number.isFinite(item) ? item : null))
    : undefined;

const normalizeDate = (value: unknown) => {
  if (typeof value !== "string") {
    return new Date(0).toISOString();
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? value : new Date(0).toISOString();
};

const normalizeImageBundleWorkItem = (
  work: Partial<ImageBundleWorkItem> & Record<string, unknown>,
  index: number
): ImageBundleWorkItem => ({
  ...work,
  id: normalizeText(work.id, `stored-image-bundle-${index + 1}`),
  kind: "image-bundle",
  title: normalizeText(work.title, `${TRIP_CLIP_TITLE_PREFIX} ${index + 1}`),
  createdAt: normalizeDate(work.createdAt),
  coverUri:
    typeof work.coverUri === "string" && work.coverUri.length > 0
      ? work.coverUri
      : undefined,
  ratio: validRatios.has(work.ratio ?? "") ? work.ratio! : "9:16",
  photoIds: normalizeStringArray(work.photoIds),
  imageUris: normalizeStringArray(work.imageUris),
  localImageUris: Array.isArray(work.localImageUris)
    ? normalizeStringArray(work.localImageUris)
    : undefined,
  imageWidths: normalizeNullableNumberArray(work.imageWidths),
  imageHeights: normalizeNullableNumberArray(work.imageHeights),
  storagePath: typeof work.storagePath === "string" ? work.storagePath : undefined,
  downloadURL: typeof work.downloadURL === "string" ? work.downloadURL : undefined,
  localFileStatus:
    work.localFileStatus === "available" || work.localFileStatus === "cloud_only"
      ? work.localFileStatus
      : undefined,
  backupStatus:
    work.backupStatus === "pending" ||
    work.backupStatus === "backed_up" ||
    work.backupStatus === "failed" ||
    work.backupStatus === "restored"
      ? work.backupStatus
      : undefined
});

const parseImageBundles = (value: string | null): ImageBundleWorkItem[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? sortImageBundles(parsed.map(normalizeImageBundleWorkItem))
      : [];
  } catch {
    return [];
  }
};

const writeImageBundles = async (items: ImageBundleWorkItem[]) => {
  await writeSortedItems(IMAGE_BUNDLE_STORAGE_KEY, items, sortImageBundles);
};

const getImageBundleDirectory = () => {
  if (!FileSystem.documentDirectory) {
    throw new Error("湲곌린?먯꽌 ?대?吏 ?묒뾽 ?뚯씪 ??μ냼瑜??ъ슜?????놁뒿?덈떎.");
  }

  return `${FileSystem.documentDirectory}${IMAGE_BUNDLE_DIRECTORY}`;
};

const ensureImageBundleDirectory = async () => {
  const directory = getImageBundleDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

export const getImageBundleWorks = async () => {
  return readStoredItems(IMAGE_BUNDLE_STORAGE_KEY, parseImageBundles);
};

export const getDeletedImageWorkIds = async () => {
  return readStoredStringSet(IMAGE_BUNDLE_DELETION_MARKER_KEY);
};

export const recordImageWorkLocalDeletion = async (id: string) => {
  const deletedImageWorkIds = await getDeletedImageWorkIds();
  deletedImageWorkIds.add(id);
  await writeStoredStringSet(IMAGE_BUNDLE_DELETION_MARKER_KEY, deletedImageWorkIds);
};

export const wasImageWorkDeletedLocally = async (id: string) =>
  (await getDeletedImageWorkIds()).has(id);

export const getImageBundleWorkById = async (id: string) => {
  const items = await getImageBundleWorks();
  const item = items.find((work) => work.id === id) ?? null;
  return item ? restoreImageBundleWorkIfNeeded(item) : null;
};

export const replaceImageBundleWorksFromBackup = async (items: ImageBundleWorkItem[]) => {
  await writeImageBundles(items);
  return getImageBundleWorks();
};

export const saveImageBundleWork = async (
  item: Omit<ImageBundleWorkItem, "id" | "createdAt" | "title" | "kind"> & {
    title?: string;
  },
  options: { localImageLimit?: number } = {}
) => {
  const items = await getImageBundleWorks();
  assertLocalLibraryCapacity({
    currentCount: items.length,
    limit: options.localImageLimit,
    label: "?대?吏"
  });
  const savedItem: ImageBundleWorkItem = {
    ...item,
    id: createLocalLibraryId(),
    kind: "image-bundle",
    createdAt: new Date().toISOString(),
    title: item.title ?? getNextTripClipTitle(items.map((work) => work.title))
  };

  await writeImageBundles([savedItem, ...items]);
  return savedItem;
};

export const updateImageBundleWork = async (
  id: string,
  updates: Partial<
    Omit<ImageBundleWorkItem, "id" | "kind" | "createdAt">
  >
) => {
  const items = await getImageBundleWorks();
  let updatedItem: ImageBundleWorkItem | null = null;
  const nextItems = items.map((item) => {
    if (item.id !== id) {
      return item;
    }

    updatedItem = {
      ...item,
      ...updates,
      id: item.id,
      kind: "image-bundle",
      createdAt: item.createdAt
    };

    return updatedItem;
  });

  if (!updatedItem) {
    return null;
  }

  await writeImageBundles(nextItems);
  return updatedItem;
};

export const restoreImageBundleWorkIfNeeded = async (work: ImageBundleWorkItem) => {
  if (work.localFileStatus !== "cloud_only") {
    return work;
  }

  const remoteUris = work.imageUris.filter((uri) => isRemoteUri(uri));
  if (remoteUris.length === 0) {
    return work;
  }

  const directory = await ensureImageBundleDirectory();
  const restoredUris = await Promise.all(
    work.imageUris.map(async (uri, index) => {
      if (!isRemoteUri(uri)) {
        return uri;
      }

      const result = await FileSystem.downloadAsync(
        uri,
        `${directory}${work.id}-${index}-restored.jpg`
      );
      return result.uri;
    })
  );
  const items = await getImageBundleWorks();
  const restoredWork: ImageBundleWorkItem = {
    ...work,
    imageUris: restoredUris,
    localImageUris: restoredUris,
    localFileStatus: "available",
    backupStatus: work.backupStatus ?? "restored"
  };

  await writeImageBundles(
    items.map((item) => (item.id === work.id ? restoredWork : item))
  );
  return restoredWork;
};

export const markImageBundleCloudOnly = async (
  id: string,
  backup: Partial<ImageBundleWorkItem> | null
) => {
  const items = await getImageBundleWorks();
  const work = items.find((item) => item.id === id);
  const remoteImageUris = backup?.imageUris?.filter((uri) => isRemoteUri(uri)) ?? [];

  if (!work || remoteImageUris.length === 0) {
    return work ?? null;
  }

  const originalUris = work.imageUris;
  const nextWork: ImageBundleWorkItem = {
    ...work,
    storagePath: backup?.storagePath ?? work.storagePath,
    localImageUris: work.localImageUris ?? originalUris,
    localFileStatus: "cloud_only",
    backupStatus: "backed_up",
    imageUris: backup?.imageUris ?? work.imageUris
  };

  await writeImageBundles(items.map((item) => (item.id === id ? nextWork : item)));
  await Promise.all(
    originalUris
      .filter((uri) => !isRemoteUri(uri) && uri !== work.coverUri)
      .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }))
  );

  return nextWork;
};

export const deleteImageBundleWork = async (id: string) => {
  await recordImageWorkLocalDeletion(id);
  const items = await getImageBundleWorks();
  const work = items.find((item) => item.id === id);
  if (work) {
    const localUris = [
      ...work.imageUris,
      ...(work.localImageUris ?? []),
      work.coverUri
    ].filter((uri): uri is string => Boolean(uri) && !isRemoteUri(uri));
    await Promise.all(
      [...new Set(localUris)].map((uri) =>
        FileSystem.deleteAsync(uri, { idempotent: true })
      )
    );
  }
  await writeImageBundles(items.filter((item) => item.id !== id));
};
