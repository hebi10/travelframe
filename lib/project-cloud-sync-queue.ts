import { localStorageAdapter } from "@/lib/local-storage";

export type ProjectCloudSyncKind = "initial" | "project-state" | "delete-project" | "delete-photo" | "delete-video" | "delete-measurement" | "supplement" | "settings" | "measurement" | "photo" | "photo-order" | "photo-metadata" | "video" | "image-work";

export type ProjectCloudSyncTask = {
  id: string;
  projectId: string;
  kind: ProjectCloudSyncKind;
  itemId?: string;
  revision: string;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
};

const KEY = "body-frame.project-cloud-sync-queue.v1";
const VALID_KINDS: readonly ProjectCloudSyncKind[] =
  ["initial", "project-state", "delete-project", "delete-photo", "delete-video", "delete-measurement", "supplement", "settings", "measurement", "photo", "photo-order", "photo-metadata", "video", "image-work"];
const listeners = new Set<() => void>();
let serial = Promise.resolve();
let activeDrain: Promise<number> | null = null;

const serialize = <T>(run: () => Promise<T>): Promise<T> => {
  const current = serial.then(run, run);
  serial = current.then(() => undefined, () => undefined);
  return current;
};

const readTasks = async (): Promise<ProjectCloudSyncTask[]> => {
  const raw = await localStorageAdapter.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ProjectCloudSyncTask => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const task = item as Record<string, unknown>;
      return typeof task.id === "string" &&
        typeof task.projectId === "string" &&
        VALID_KINDS.includes(task.kind as ProjectCloudSyncKind) &&
        typeof task.revision === "string" &&
        typeof task.nextAttemptAt === "number" &&
        typeof task.attempts === "number";
    });
  } catch {
    return [];
  }
};

const publish = () => listeners.forEach((listener) => listener());
const store = async (tasks: ProjectCloudSyncTask[]) => {
  await localStorageAdapter.setItem(KEY, JSON.stringify(tasks));
  publish();
};

export const subscribeProjectCloudSync = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const getProjectCloudSyncTasks = readTasks;

export const enqueueProjectCloudSync = ({
  projectId,
  kind,
  itemId
}: {
  projectId: string;
  kind: ProjectCloudSyncKind;
  itemId?: string;
}): Promise<ProjectCloudSyncTask> => serialize(async () => {
  if (!projectId || !VALID_KINDS.includes(kind) ||
      (!["supplement", "settings", "initial", "project-state", "delete-project", "photo-order"].includes(kind) && !itemId)) {
    throw new Error("백업 대기열 대상이 올바르지 않습니다.");
  }
  const id = [kind, projectId, itemId ?? ""].join(":");
  const now = Date.now();
  const tasks = await readTasks();
  const existing = tasks.find((task) => task.id === id);
  const item: ProjectCloudSyncTask = {
    id, kind, projectId,
    ...(itemId ? { itemId } : {}),
    revision: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: existing?.createdAt ?? new Date(now).toISOString(),
    attempts: 0,
    nextAttemptAt: now
  };
  await store([...tasks.filter((task) => task.id !== id), item]);
  return item;
});

export const processProjectCloudSyncQueue = ({
  execute,
  now = Date.now(),
  maxItems = 6,
  canExecute = () => true
}: {
  execute: (task: ProjectCloudSyncTask) => Promise<void>;
  now?: number;
  maxItems?: number;
  canExecute?: (task: ProjectCloudSyncTask) => boolean;
}): Promise<number> => {
  if (activeDrain) return activeDrain;
  const run = async () => {
    const tasks = (await readTasks())
      .filter((task) => task.nextAttemptAt <= now && canExecute(task))
      .slice(0, maxItems);
    let processed = 0;
    for (const task of tasks) {
      try {
        await execute(task);
        await serialize(async () => {
          const current = await readTasks();
          if (current.some((value) => value.id === task.id && value.revision === task.revision)) {
            await store(current.filter((value) => value.id !== task.id));
          }
        });
        processed += 1;
      } catch {
        await serialize(async () => {
          const current = await readTasks();
          const pending = current.find((value) => value.id === task.id);
          if (!pending || pending.revision !== task.revision) return;
          const attempts = pending.attempts + 1;
          const delay = Math.min(30 * 60_000, 30_000 * (2 ** Math.min(attempts - 1, 6)));
          await store(current.map((value) => value.id === task.id
            ? { ...value, attempts, nextAttemptAt: now + delay }
            : value));
        });
      }
    }
    return processed;
  };
  activeDrain = run().finally(() => { activeDrain = null; });
  return activeDrain;
};
