import {
  defaultBodyMeasurementSettings,
  bodyMeasurementValueFields,
  type BodyMeasurementEntry,
  type BodyMeasurementFields,
  type BodyMeasurementMetric,
  type BodyMeasurementSettings
} from "@/types/body-measurement";

const measurementRanges = {
  weightKg: { min: 20, max: 500 },
  bodyFatPercent: { min: 1, max: 70 },
  skeletalMuscleKg: { min: 5, max: 150 },
  waistCm: { min: 30, max: 300 }
} as const;

const normalizeIsoDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? value : null;
};

const normalizeOptionalNumber = (
  value: unknown,
  range: { min: number; max: number }
) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < range.min || value > range.max) return undefined;
  return Number(value.toFixed(2));
};

const normalizeMetric = (value: unknown): BodyMeasurementMetric =>
  value === "weight" ||
  value === "bodyFat" ||
  value === "skeletalMuscle" ||
  value === "waist"
    ? value
    : "weight";

const normalizeFields = (value: unknown): BodyMeasurementFields => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultBodyMeasurementSettings.fields;
  }

  const record = value as Record<string, unknown>;
  return {
    weight: record.weight !== false,
    bodyFat: record.bodyFat === true,
    skeletalMuscle: record.skeletalMuscle === true,
    waist: record.waist === true
  };
};

export const normalizeBodyMeasurementSettings = (
  value: unknown
): BodyMeasurementSettings => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultBodyMeasurementSettings;
  }

  const record = value as Record<string, unknown>;
  const fields = normalizeFields(record.fields);
  let primaryMetric = normalizeMetric(record.primaryMetric);

  if (!fields[primaryMetric]) {
    primaryMetric =
      (Object.entries(fields).find(([, enabled]) => enabled)?.[0] as
        | BodyMeasurementMetric
        | undefined) ?? "weight";
  }

  return {
    enabled: record.enabled === true,
    fields,
    primaryMetric,
    promptAfterCapture: record.promptAfterCapture === true
  };
};

const getLegacyManualFields = (values: Pick<BodyMeasurementEntry, "skeletalMuscleKg" | "waistCm" | "note">) =>
  (["skeletalMuscleKg", "waistCm", "note"] as const).filter((field) => values[field] !== undefined);

export const normalizeBodyMeasurementEntry = (
  value: unknown
): BodyMeasurementEntry | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const projectId =
    typeof record.projectId === "string" ? record.projectId.trim() : "";
  const recordedAt = normalizeIsoDate(record.recordedAt);

  if (!id || !projectId || !recordedAt) {
    return null;
  }

  const photoId =
    typeof record.photoId === "string" && record.photoId.trim()
      ? record.photoId.trim()
      : undefined;
  const sequence =
    typeof record.sequence === "number" &&
    Number.isInteger(record.sequence) &&
    record.sequence > 0
      ? record.sequence
      : undefined;
  const note =
    typeof record.note === "string" && record.note.trim()
      ? record.note.trim().slice(0, 500)
      : undefined;
  const sourceRecordId =
    typeof record.sourceRecordId === "string" && record.sourceRecordId.trim()
      ? record.sourceRecordId.trim()
      : undefined;
  const sourceAppPackage =
    typeof record.sourceAppPackage === "string" && record.sourceAppPackage.trim()
      ? record.sourceAppPackage.trim()
      : undefined;

  const source = record.source === "health_connect" ? "health_connect" : "manual";
  const skeletalMuscleKg = normalizeOptionalNumber(record.skeletalMuscleKg, measurementRanges.skeletalMuscleKg);
  const waistCm = normalizeOptionalNumber(record.waistCm, measurementRanges.waistCm);
  const manualFields = source !== "health_connect" ? [] : Array.isArray(record.manualFields)
    ? bodyMeasurementValueFields.filter((field) => (record.manualFields as unknown[]).includes(field))
    : getLegacyManualFields({ skeletalMuscleKg, waistCm, note });
  const manualRecordedAt = manualFields.length ? normalizeIsoDate(record.manualRecordedAt) : null;
  const sourceMemberIds = source === "health_connect" && Array.isArray(record.sourceMemberIds)
    ? [...new Set(record.sourceMemberIds.flatMap((value: unknown) =>
        typeof value === "string" && value.trim() ? [value.trim()] : []))]
    : [];

  return {
    id,
    projectId,
    ...(photoId ? { photoId } : {}),
    ...(sequence ? { sequence } : {}),
    recordedAt,
    ...(normalizeOptionalNumber(record.weightKg, measurementRanges.weightKg) !== undefined
      ? { weightKg: normalizeOptionalNumber(record.weightKg, measurementRanges.weightKg) }
      : {}),
    ...(normalizeOptionalNumber(record.bodyFatPercent, measurementRanges.bodyFatPercent) !== undefined
      ? {
          bodyFatPercent: normalizeOptionalNumber(
            record.bodyFatPercent,
            measurementRanges.bodyFatPercent
          )
        }
      : {}),
    ...(skeletalMuscleKg !== undefined ? { skeletalMuscleKg } : {}),
    ...(waistCm !== undefined ? { waistCm } : {}),
    ...(note ? { note } : {}),
    source,
    ...(sourceRecordId ? { sourceRecordId } : {}),
    ...(sourceAppPackage ? { sourceAppPackage } : {}),
    ...(sourceMemberIds.length ? { sourceMemberIds } : {}),
    ...(manualFields.length ? { manualFields } : {}),
    ...(manualRecordedAt ? { manualRecordedAt } : {})
  };
};

export const getCloudBodyMeasurement = (entry: BodyMeasurementEntry, backedUpAt: string) => {
  const { sourceAppPackage, sourceRecordId, sourceMemberIds, manualFields, manualRecordedAt, ...local } = entry;
  if (local.source === "manual") return local;
  const fields = manualFields ?? getLegacyManualFields(entry);
  const values = Object.fromEntries(fields
    .filter((field) => entry[field] !== undefined)
    .map((field) => [field, entry[field]]));
  if (!Object.keys(values).length) return null;

  // Older records stored the import time in the local ID, independently of the Health Connect timestamp.
  const importedAt = /^measurement-(\d{13})-/.exec(entry.id)?.[1];
  const legacyDate = importedAt ? new Date(Number(importedAt)).toISOString() : backedUpAt;
  return {
    id: entry.id,
    projectId: entry.projectId,
    ...(entry.photoId ? { photoId: entry.photoId } : {}),
    ...(entry.sequence ? { sequence: entry.sequence } : {}),
    recordedAt: manualRecordedAt ?? legacyDate,
    source: "manual" as const,
    ...values
  };
};

export const parseMeasurementInput = (
  value: string,
  range: { min: number; max: number }
) => {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < range.min || parsed > range.max) {
    return null;
  }
  return Number(parsed.toFixed(2));
};

export const bodyMeasurementInputRanges = measurementRanges;
