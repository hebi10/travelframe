import AsyncStorage from "@react-native-async-storage/async-storage";

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export const localStorageAdapter: StorageLike = AsyncStorage;
