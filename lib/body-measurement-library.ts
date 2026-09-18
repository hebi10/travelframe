import { localStorageAdapter } from "@/lib/local-storage";
import {
  normalizeBodyMeasurementEntry,
  normalizeBodyMeasurementSettings
} from "@/lib/body-measurement-normalization";
import {
  defaultBodyMeasurementSettings,
  type BodyMeasurementEntry,
  type BodyMeasurementSettings
} from "@/types/body-measurement";

export const BODY_MEASUREMENT_STORAGE_KEY = "body-frame.measurements.v1";
export const BODY_MEASUREMENT_SETTINGS_STORAGE_KEY =
  "body-frame.measurement-settings.v1";

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

export const getBodyMeasurementSettings = async (projectId: string) => {
  const settings = await readSettingsMap();
  return settings[projectId] ?? defaultBodyMeasurementSettings;
};

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
  note
}: Omit<BodyMeasurementEntry, "id" | "source"> & { id?: string }) =>
  runMutation(async () => {
    const entries = await readEntries();
    const nowId = id ?? createMeasurementId();
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
      source: "manual"
    });

    if (!normalized) {
      throw new Error("수치 기록을 저장할 수 없습니다.");
    }

    const nextEntries = [
      ...entries.filter((entry) => entry.id !== normalized.id),
      normalized
    ];
    await writeEntries(nextEntries);
    return normalized;
  });

export const deleteBodyMeasurement = async (id: string) =>
  runMutation(async () => {
    const entries = await readEntries();
    await writeEntries(entries.filter((entry) => entry.id !== id));
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
    }
  });
