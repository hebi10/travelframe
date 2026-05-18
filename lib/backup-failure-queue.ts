import { localStorageAdapter } from "@/lib/local-storage";

export type BackupFailureKind = "photo" | "image-bundle" | "video";

export type BackupFailureRecord = {
  id: string;
  kind: BackupFailureKind;
  label: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
};

const BACKUP_FAILURE_QUEUE_KEY = "travel-frame.backup-failure-queue.v1";

const parseBackupFailures = (value: string | null): BackupFailureRecord[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as BackupFailureRecord[]) : [];
  } catch {
    return [];
  }
};

const writeBackupFailures = async (records: BackupFailureRecord[]) => {
  await localStorageAdapter.setItem(
    BACKUP_FAILURE_QUEUE_KEY,
    JSON.stringify(records)
  );
};

export const getBackupFailures = async () => {
  const value = await localStorageAdapter.getItem(BACKUP_FAILURE_QUEUE_KEY);
  return parseBackupFailures(value);
};

export const recordBackupFailure = async ({
  id,
  kind,
  label,
  message
}: {
  id: string;
  kind: BackupFailureKind;
  label: string;
  message?: string;
}) => {
  const records = await getBackupFailures();
  const now = new Date().toISOString();
  const existing = records.find((record) => record.id === id);
  const nextRecord: BackupFailureRecord = {
    id,
    kind,
    label,
    message,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  await writeBackupFailures([
    nextRecord,
    ...records.filter((record) => record.id !== id)
  ]);
  return nextRecord;
};

export const clearBackupFailure = async (id: string) => {
  const records = await getBackupFailures();
  await writeBackupFailures(records.filter((record) => record.id !== id));
};

export const clearBackupFailures = async () => {
  await writeBackupFailures([]);
};
