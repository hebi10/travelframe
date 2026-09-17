import { normalizeLastActiveProjectId } from "@/lib/body-frame-normalization";
import { localStorageAdapter } from "@/lib/local-storage";

export const LAST_ACTIVE_PROJECT_ID_STORAGE_KEY = "body-frame.last-active-project-id.v1";

export const getLastActiveProjectId = async () => {
  const value = await localStorageAdapter.getItem(LAST_ACTIVE_PROJECT_ID_STORAGE_KEY);
  return normalizeLastActiveProjectId(value);
};

export const setLastActiveProjectId = async (projectId: string | null) => {
  const normalizedProjectId = normalizeLastActiveProjectId(projectId);

  if (!normalizedProjectId) {
    await localStorageAdapter.removeItem(LAST_ACTIVE_PROJECT_ID_STORAGE_KEY);
    return null;
  }

  await localStorageAdapter.setItem(
    LAST_ACTIVE_PROJECT_ID_STORAGE_KEY,
    normalizedProjectId
  );
  return normalizedProjectId;
};

export const clearLastActiveProjectId = async () => {
  await localStorageAdapter.removeItem(LAST_ACTIVE_PROJECT_ID_STORAGE_KEY);
};
