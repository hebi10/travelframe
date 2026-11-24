import { localStorageAdapter } from "@/lib/local-storage";
import { enqueueProjectCloudSync } from "@/lib/project-cloud-sync-queue";
import {
  normalizeBodyMeasurementEntry,
  normalizeBodyMeasurementSettings
} from "@/lib/body-measurement-normalization";
import {
  defaultBodyMeasurementSettings,
  type BodyMeasurementEntry,
  type BodyMeasurementSettings
} from "@/types/body-measurement";

export const BODY_MEASUREMENT_STORAGE_KEY = ["body-frame", "measurements", "v1"].join(".");
export const BODY_MEASUREMENT_SETTINGS_STORAGE_KEY = [
  "body-frame",
  "measurement-settings",
  "v1"
].join(".");
export const DELETED_BODY_MEASUREMENTS_STORAGE_KEY = "body-frame.measurements.deleted.v1";

let mutationChain = Promise.resolve();

const runMutation = async <T>(operation: () => Promise<T>) => {
  const run = mutationChain.then(operation, operation);
  mutationChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

const createMeasurementId = () =>
  `measurement-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const readEntries = async () => {
  const raw = await localStorageAdapter.getItem(BODY_MEASUREMENT_STORAGE_KEY);
  if (!raw) return [] as BodyMeasurementEntry[];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeBodyMeasurementEntry(item))
      .filter((item): item is BodyMeasurementEntry => Boolean(item))
      .sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      );
  } catch {
    return [];
  }
};

const writeEntries = async (entries: BodyMeasurementEntry[]) => {
  const normalized = entries
    .map((entry) => normalizeBodyMeasurementEntry(entry))
    .filter((entry): entry is BodyMeasurementEntry => Boolean(entry));

  await localStorageAdapter.setItem(
    BODY_MEASUREMENT_STORAGE_KEY,
    JSON.stringify(normalized)
  );
};

const readDeletedMeasurementIds = async () => {
  const value = await localStorageAdapter.getItem(DELETED_BODY_MEASUREMENTS_STORAGE_KEY);
  if (!value) return new Set<string>();
  try {
    const parsed: unknown = JSON.parse(value);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string" && id.length > 0)
        : []
    );
  } catch {
    return new Set<string>();
  }
};

const writeDeletedMeasurementIds = async (ids: ReadonlySet<string>) => {
  await localStorageAdapter.setItem(
    DELETED_BODY_MEASUREMENTS_STORAGE_KEY,
    JSON.stringify([...ids])
  );
};

const readSettingsMap = async () => {
  const raw = await localStorageAdapter.getItem(
    BODY_MEASUREMENT_SETTINGS_STORAGE_KEY
  );

  if (!raw) return {} as Record<string, BodyMeasurementSettings>;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([projectId, value]) => [
        projectId,
        normalizeBodyMeasurementSettings(value)
      ])
    );
  } catch {
    return {};
  }
};

export const initializeNewBodyProjectMeasurements = async (projectId: string) =>
  runMutation(async () => {
    const map = await readSettingsMap();
    if (Object.prototype.hasOwnProperty.call(map, projectId)) {
      return map[projectId];
    }
    const settings = normalizeBodyMeasurementSettings({
      ...defaultBodyMeasurementSettings,
      enabled: true,
      promptAfterCapture: true
    });
    await localStorageAdapter.setItem(
      BODY_MEASUREMENT_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...map, [projectId]: settings })
    );
    return settings;
  });

export const getBodyMeasurementSettings = async (projectId: string) => {
  const settings = await readSettingsMap();
  return settings[projectId] ?? defaultBodyMeasurementSettings;
};

export const mergeBodyMeasurementSettingsFromBackup = async (
  settingsByProject: ReadonlyArray<{ projectId: string; settings: BodyMeasurementSettings }>
) =>
  runMutation(async () => {
    const map = await readSettingsMap();
    const next = { ...map };
    let changed = false;
    for (const item of settingsByProject) {
      if (!item.projectId || Object.prototype.hasOwnProperty.call(next, item.projectId)) continue;
      next[item.projectId] = normalizeBodyMeasurementSettings(item.settings);
      changed = true;
    }
    if (changed) {
      await localStorageAdapter.setItem(
        BODY_MEASUREMENT_SETTINGS_STORAGE_KEY,
        JSON.stringify(next)
      );
    }
    return changed;
  });

export const updateBodyMeasurementSettings = async (
  projectId: string,
  patch: Partial<BodyMeasurementSettings>
) =>
  runMutation(async () => {
    const map = await readSettingsMap();
    const current = map[projectId] ?? defaultBodyMeasurementSettings;
    const next = normalizeBodyMeasurementSettings({
      ...current,
      ...patch,
      fields: patch.fields ? { ...current.fields, ...patch.fields } : current.fields
    });

    const nextMap = { ...map, [projectId]: next };
    await localStorageAdapter.setItem(
      BODY_MEASUREMENT_SETTINGS_STORAGE_KEY,
      JSON.stringify(nextMap)
    );
    await enqueueProjectCloudSync({ projectId, kind: "settings" }).catch(() => undefined);
    return next;
  });

export const getBodyMeasurements = async (projectId?: string) => {
  const entries = await readEntries();
  return projectId
    ? entries.filter((entry) => entry.projectId === projectId)
    : entries;
};

export const getBodyMeasurementByPhotoId = async (
  projectId: string,
  photoId: string
) => {
  const entries = await getBodyMeasurements(projectId);
  return entries.find((entry) => entry.photoId === photoId) ?? null;
};

export const saveBodyMeasurement = async ({
  id,
  projectId,
  photoId,
  sequence,
  recordedAt,
  weightKg,
  bodyFatPercent,
  skeletalMuscleKg,
  waistCm,
  note,
  source = "manual",
  sourceRecordId,
  sourceMemberIds,
  sourceAppPackage,
  manualFields,
  manualRecordedAt
}: Omit<BodyMeasurementEntry, "id"> & { id?: string; source?: BodyMeasurementEntry["source"] }) =>
  runMutation(async () => {
    const entries = await readEntries();
    const matchingManual = !id && photoId && source === "manual"
      ? entries.find((entry) =>
          entry.projectId === projectId &&
          entry.photoId === photoId &&
          entry.source === "manual"
        )
      : null;
    const nowId = id ?? matchingManual?.id ?? createMeasurementId();
    const normalized = normalizeBodyMeasurementEntry({
      id: nowId,
      projectId,
      photoId,
      sequence,
      recordedAt,
      weightKg,
      bodyFatPercent,
      skeletalMuscleKg,
      waistCm,
      note,
      source,
      sourceRecordId,
      sourceMemberIds: sourceMemberIds ?? entries.find((entry) => entry.id === nowId)?.sourceMemberIds,
      sourceAppPackage,
      manualFields,
      manualRecordedAt
    });

    if (!normalized) {
      throw new Error("수치 기록을 저장할 수 없습니다.");
    }

    const nextEntries = [
      ...entries.filter((entry) => entry.id !== normalized.id),
      normalized
    ];
    await writeEntries(nextEntries);
    const tombstones = await readDeletedMeasurementIds();
    if (tombstones.delete(normalized.id)) await writeDeletedMeasurementIds(tombstones);
    if (normalized.source === "manual" || normalized.manualFields?.length) {
      await enqueueProjectCloudSync({ projectId, kind: "measurement", itemId: normalized.id })
        .catch(() => undefined);
    }
    return normalized;
  });

export const mergeBodyMeasurementsFromBackup = async (
  incoming: ReadonlyArray<BodyMeasurementEntry>,
  restorableIds: ReadonlySet<string> = new Set()
) =>
  runMutation(async () => {
    const [current, deletedIds] = await Promise.all([
      readEntries(),
      readDeletedMeasurementIds()
    ]);
    const existingIds = new Set(current.map((entry) => entry.id));
    const existingLinks = new Set(
      current.flatMap((entry) => {
        if (entry.photoId && entry.source === "manual") return [`${entry.projectId}:manual:${entry.photoId}`];
        if (entry.source === "health_connect" && entry.sourceRecordId) {
          return [`${entry.projectId}:health:${entry.sourceRecordId}`];
        }
        return [];
      })
    );
    const added: BodyMeasurementEntry[] = [];
    for (const value of incoming) {
      const entry = normalizeBodyMeasurementEntry(value);
      if (!entry || existingIds.has(entry.id) ||
          (deletedIds.has(entry.id) && !restorableIds.has(entry.id))) continue;
      const link = entry.photoId && entry.source === "manual"
        ? `${entry.projectId}:manual:${entry.photoId}`
        : entry.source === "health_connect" && entry.sourceRecordId
          ? `${entry.projectId}:health:${entry.sourceRecordId}`
          : null;
      if (link && existingLinks.has(link)) continue;
      existingIds.add(entry.id);
      if (link) existingLinks.add(link);
      added.push(entry);
    }
    if (added.length > 0) await writeEntries([...current, ...added]);
    const deletedCount = deletedIds.size;
    for (const entry of incoming) {
      if (restorableIds.has(entry.id) && existingIds.has(entry.id)) deletedIds.delete(entry.id);
    }
    if (deletedIds.size !== deletedCount) await writeDeletedMeasurementIds(deletedIds);
    return added;
  });

export const getBodyMeasurementBySourceRecordId = async (
  projectId: string,
  sourceRecordId: string
) => {
  const entries = await getBodyMeasurements(projectId);
  return (
    entries.find(
      (entry) =>
        entry.source === "health_connect" &&
        (entry.sourceRecordId === sourceRecordId || entry.sourceMemberIds?.includes(sourceRecordId))
    ) ?? null
  );
};

export const deleteBodyMeasurement = async (id: string, { projectDeletion = false } = {}) =>
  runMutation(async () => {
    const entries = await readEntries();
    const deletedIds = await readDeletedMeasurementIds();
    deletedIds.add(id);
    await writeDeletedMeasurementIds(deletedIds);
    await writeEntries(entries.filter((entry) => entry.id !== id));
    const removed = entries.find((entry) => entry.id === id);
    if (removed && !projectDeletion) {
      await enqueueProjectCloudSync({ projectId: removed.projectId, kind: "delete-measurement", itemId: id });
    }
  });

export const detachBodyMeasurementsFromPhoto = async (photoId: string) =>
  runMutation(async () => {
    const entries = await readEntries();
    let changed = false;
    const next = entries.map((entry) => {
      if (entry.photoId !== photoId) return entry;
      changed = true;
      const { photoId: _photoId, ...rest } = entry;
      return rest;
    });

    if (changed) {
      await writeEntries(next);
      for (const entry of entries.filter((item) => item.photoId === photoId &&
        (item.source === "manual" || item.manualFields?.length))) {
        await enqueueProjectCloudSync({ projectId: entry.projectId, kind: "measurement", itemId: entry.id });
      }
    }
  });

export const syncBodyMeasurementPhotoSequences = async (
  projectId: string,
  sequenceByPhotoId: Map<string, number>
) =>
  runMutation(async () => {
    const entries = await readEntries();
    let changed = false;
    const next = entries.map((entry) => {
      if (entry.projectId !== projectId || !entry.photoId) {
        return entry;
      }

      const sequence = sequenceByPhotoId.get(entry.photoId);
      if (!sequence || entry.sequence === sequence) {
        return entry;
      }

      changed = true;
      return {
        ...entry,
        sequence
      };
    });

    if (changed) {
      await writeEntries(next);
    }
  });
