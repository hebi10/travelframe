import * as FileSystem from "expo-file-system/legacy";

import { localStorageAdapter } from "@/lib/local-storage";
import { assertLocalLibraryCapacity } from "@/lib/local-library-limit";
import type { ImageBundleWorkItem } from "@/types/work";

const IMAGE_BUNDLE_STORAGE_KEY = "travel-frame.image-bundles.v1";
const IMAGE_BUNDLE_DIRECTORY = "image-bundles/";

const createWorkId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sortImageBundles = (items: ImageBundleWorkItem[]) =>
  [...items].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  );

const parseImageBundles = (value: string | null): ImageBundleWorkItem[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? sortImageBundles(parsed as ImageBundleWorkItem[])
      : [];
  } catch {
    return [];
  }
};

const writeImageBundles = async (items: ImageBundleWorkItem[]) => {
  await localStorageAdapter.setItem(
    IMAGE_BUNDLE_STORAGE_KEY,
    JSON.stringify(sortImageBundles(items))
  );
};

const getImageBundleDirectory = () => {
  if (!FileSystem.documentDirectory) {
    throw new Error("기기에서 이미지 작업 파일 저장소를 사용할 수 없습니다.");
  }

  return `${FileSystem.documentDirectory}${IMAGE_BUNDLE_DIRECTORY}`;
};

const ensureImageBundleDirectory = async () => {
  const directory = getImageBundleDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

const isRemoteUri = (uri?: string | null) =>
  typeof uri === "string" && /^https?:\/\//i.test(uri);

export const getImageBundleWorks = async () => {
  const value = await localStorageAdapter.getItem(IMAGE_BUNDLE_STORAGE_KEY);
  return parseImageBundles(value);
};

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
    label: "이미지"
  });
  const savedItem: ImageBundleWorkItem = {
    ...item,
    id: createWorkId(),
    kind: "image-bundle",
    createdAt: new Date().toISOString(),
    title: item.title ?? `영상 만들기 ${items.length + 1}`
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
