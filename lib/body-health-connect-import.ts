import type { BodyHealthConnectCandidate } from "@/lib/body-health-connect";
import type { BodyMeasurementEntry } from "@/types/body-measurement";
import type { PhotoItem } from "@/types/photo";

type ImportedMeasurement = Pick<BodyMeasurementEntry, "recordedAt" | "weightKg" | "bodyFatPercent" | "sourceAppPackage"> & {
  sourceRecordId: string;
  originalRecordIds: string[];
};

export const groupBodyHealthConnectMeasurements = (candidates: readonly BodyHealthConnectCandidate[]) => {
  const groups = new Map<string, ImportedMeasurement>();
  for (const candidate of candidates) {
    const timestamp = Date.parse(candidate.recordedAt);
    if (!Number.isFinite(timestamp)) continue;
    const recordedAt = new Date(timestamp).toISOString();
    const sourceRecordId = `health-connect:${recordedAt}:${candidate.sourceAppPackage ?? ""}`;
    const group = groups.get(sourceRecordId) ?? {
      sourceRecordId,
      originalRecordIds: [],
      recordedAt,
      sourceAppPackage: candidate.sourceAppPackage
    };
    group.originalRecordIds.push(candidate.sourceRecordId);
    if (candidate.metric === "weight") group.weightKg ??= candidate.value;
    else group.bodyFatPercent ??= candidate.value;
    groups.set(sourceRecordId, group);
  }
  return [...groups.values()];
};

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
});

export const findHealthConnectPhoto = (
  recordedAt: string,
  photos: readonly PhotoItem[],
  occupiedPhotoIds: ReadonlySet<string>
) => {
  const timestamp = Date.parse(recordedAt);
  if (!Number.isFinite(timestamp)) return undefined;
  const day = dayFormat.format(timestamp);
  return photos
    .filter((photo) => !occupiedPhotoIds.has(photo.id) &&
      Number.isFinite(Date.parse(photo.createdAt)) && dayFormat.format(new Date(photo.createdAt)) === day)
    .sort((a, b) =>
      Math.abs(Date.parse(a.createdAt) - timestamp) - Math.abs(Date.parse(b.createdAt) - timestamp) ||
      (a.sequence ?? 0) - (b.sequence ?? 0)
    )[0];
};
