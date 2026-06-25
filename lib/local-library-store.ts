import AsyncStorage from "@react-native-async-storage/async-storage";

export const createLocalLibraryId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const isRemoteUri = (uri?: string | null) =>
  typeof uri === "string" && /^https?:\/\//i.test(uri);

export const parseStoredStringSet = (value: string | null) => {
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

export const readStoredStringSet = async (key: string) =>
  parseStoredStringSet(await AsyncStorage.getItem(key));

export const writeStoredStringSet = async (key: string, values: Set<string>) => {
  await AsyncStorage.setItem(key, JSON.stringify([...values]));
};

export const readStoredItems = async <T>(
  key: string,
  parse: (value: string | null) => T[]
) => parse(await AsyncStorage.getItem(key));

export const writeSortedItems = async <T>(
  key: string,
  items: T[],
  sort: (items: T[]) => T[]
) => {
  await AsyncStorage.setItem(key, JSON.stringify(sort(items)));
};
