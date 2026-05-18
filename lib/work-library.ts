import { localStorageAdapter } from "@/lib/local-storage";
import type { ImageBundleWorkItem } from "@/types/work";

const IMAGE_BUNDLE_STORAGE_KEY = "travel-frame.image-bundles.v1";

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

export const getImageBundleWorks = async () => {
  const value = await localStorageAdapter.getItem(IMAGE_BUNDLE_STORAGE_KEY);
  return parseImageBundles(value);
};

export const getImageBundleWorkById = async (id: string) => {
  const items = await getImageBundleWorks();
  return items.find((item) => item.id === id) ?? null;
};

export const replaceImageBundleWorksFromBackup = async (items: ImageBundleWorkItem[]) => {
  await writeImageBundles(items);
  return getImageBundleWorks();
};

export const saveImageBundleWork = async (
  item: Omit<ImageBundleWorkItem, "id" | "createdAt" | "title" | "kind"> & {
    title?: string;
  }
) => {
  const items = await getImageBundleWorks();
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

export const deleteImageBundleWork = async (id: string) => {
  const items = await getImageBundleWorks();
  await writeImageBundles(items.filter((item) => item.id !== id));
};
