import { localStorageAdapter } from "@/lib/local-storage";

const OWNER_KEY = "body-frame.local-library-owner.v1";
const RECORD_KEYS = [
  "travel-frame.photos.v1", "travel-frame.videos.v1", "travel-frame.image-bundles.v1",
  "body-frame.projects.v1", "body-frame.measurements.v1",
  "travel-frame.edit-draft.v1", "travel-frame.trip-clip-draft.v1"
];
export type LocalLibraryAccess = "allowed" | "locked" | "claim-required";
let ownershipMutation = Promise.resolve();
const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = ownershipMutation.then(operation, operation);
  ownershipMutation = result.then(() => undefined, () => undefined);
  return result;
};

const hasExistingRecords = async () => {
  const records = await Promise.all(RECORD_KEYS.map(key => localStorageAdapter.getItem(key)));
  return records.some(raw => {
    if (!raw) return false;
    try {
      const value: unknown = JSON.parse(raw);
      return !Array.isArray(value) || value.length > 0;
    } catch {
      return true;
    }
  });
};

// One device library retains its original owner; no records are removed on logout.
export const checkLocalLibraryAccess = (uid: string | null): Promise<LocalLibraryAccess> => serialize(async () => {
  const owner = await localStorageAdapter.getItem(OWNER_KEY);
  if (owner) return owner === uid ? "allowed" : "locked";
  if (!uid) return "allowed";
  if (await hasExistingRecords()) return "claim-required";
  await localStorageAdapter.setItem(OWNER_KEY, uid);
  return "allowed";
});

// Invoke only after the user explicitly accepts ownership of unclaimed local records.
export const claimLocalLibrary = (uid: string): Promise<void> => serialize(async () => {
  if (!uid) throw new Error("로그인이 필요합니다.");
  const owner = await localStorageAdapter.getItem(OWNER_KEY);
  if (owner && owner !== uid) throw new Error("이 기기의 기록은 다른 계정에 연결되어 있습니다.");
  await localStorageAdapter.setItem(OWNER_KEY, uid);
});

// Cloud callers must check the authenticated UID separately, then call this guard.
export const assertLocalLibraryOwner = async (uid: string): Promise<void> => {
  const owner = await localStorageAdapter.getItem(OWNER_KEY);
  if (!uid || owner !== uid) throw new Error("기존 기록의 계정 연결을 먼저 확인해 주세요.");
};
