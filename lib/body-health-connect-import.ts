import type { BodyHealthConnectCandidate } from "@/lib/body-health-connect";
import type { BodyMeasurementEntry } from "@/types/body-measurement";
import type { PhotoItem } from "@/types/photo";

type ImportedMeasurement = Pick<BodyMeasurementEntry, "recordedAt" | "weightKg" | "bodyFatPercent" | "sourceAppPackage"> & {
  sourceRecordId: string;
  originalRecordIds: string[];
  legacyGroupIds: string[];
};

const MATCH_WINDOW_MS = 60_000;

const getGroupId = (timestamp: number, source?: string) =>
  `health-connect:${new Date(timestamp).toISOString()}:${source ?? ""}`;

export const indexHealthConnectMeasurements = (entries: readonly BodyMeasurementEntry[]) => {
  const indexed = new Map<string, BodyMeasurementEntry>();
  for (const entry of entries) {
    if (entry.source !== "health_connect") continue;
    for (const id of [entry.sourceRecordId, ...(entry.sourceMemberIds ?? [])]) {
      if (id && (!indexed.has(id) || (!indexed.get(id)?.photoId && entry.photoId))) indexed.set(id, entry);
    }
  }
  return indexed;
};

export const resolveHealthConnectMeasurementMatch = (
  group: Pick<ImportedMeasurement, "sourceRecordId" | "originalRecordIds" | "legacyGroupIds">,
  savedEntries: readonly BodyMeasurementEntry[],
  matchedEntryIds: ReadonlySet<string>
) => {
  const memberIds = new Set(group.originalRecordIds);
  const eligible = savedEntries.filter((entry) =>
    entry.source === "health_connect" && !matchedEntryIds.has(entry.id)
  );
  const members = eligible.filter((entry) =>
    entry.sourceMemberIds?.some((id) => memberIds.has(id))
  );
  const fallbackIds = new Set([group.sourceRecordId, ...group.legacyGroupIds, ...group.originalRecordIds]);
  const legacy = eligible.filter((entry) =>
    !entry.sourceMemberIds?.length && entry.sourceRecordId && fallbackIds.has(entry.sourceRecordId)
  );
  const existing = members.find((entry) => entry.photoId) ?? members[0] ??
    legacy.find((entry) => entry.sourceRecordId === group.sourceRecordId) ??
    legacy.find((entry) => entry.photoId) ?? legacy[0];
  return { existing, legacy };
};

export const groupBodyHealthConnectMeasurements = (
  candidates: readonly BodyHealthConnectCandidate[],
  savedEntries: readonly BodyMeasurementEntry[] = []
) => {
  const pairedIds = new Map<string, string>();
  for (const entry of savedEntries) {
    if (entry.source !== "health_connect" || !entry.sourceMemberIds || entry.sourceMemberIds.length < 2) continue;
    for (const id of entry.sourceMemberIds) pairedIds.set(id, entry.id);
  }

  const records = candidates.map((candidate) => ({ candidate, time: Date.parse(candidate.recordedAt) }))
    .filter(({ time }) => Number.isFinite(time))
    .sort((a, b) => a.time - b.time);
  type Record = typeof records[number];
  const pairs: { left: Record; right: Record; difference: number }[] = [];
  for (const [index, left] of records.entries()) {
    const source = left.candidate.sourceAppPackage;
    if (!source) continue;
    for (let next = index + 1; next < records.length; next++) {
      const right = records[next];
      const difference = right.time - left.time;
      if (difference > MATCH_WINDOW_MS) break;
      if (right.candidate.sourceAppPackage === source && right.candidate.metric !== left.candidate.metric &&
          pairedIds.get(left.candidate.sourceRecordId) === pairedIds.get(right.candidate.sourceRecordId)) {
        pairs.push({ left, right, difference });
      }
    }
  }
  const matches = new Map<Record, Record>();
  const paired = new Set<Record>();
  for (const { left, right } of pairs.sort((a, b) => a.difference - b.difference)) {
    if (paired.has(left) || paired.has(right)) continue;
    matches.set(left, right);
    paired.add(left);
    paired.add(right);
  }

  const groups: ImportedMeasurement[] = [];
  const ids = new Set<string>();
  for (const record of records) {
    const other = matches.get(record);
    if (!other && paired.has(record)) continue;
    const members = other ? [record, other] : [record];
    const source = record.candidate.sourceAppPackage;
    const groupId = getGroupId(record.time, source);
    const id = ids.has(groupId) ? `${groupId}:${record.candidate.sourceRecordId}` : groupId;
    ids.add(id);
    groups.push({
      sourceRecordId: id,
      originalRecordIds: members.map(({ candidate }) => candidate.sourceRecordId),
      legacyGroupIds: members.map(({ time }) => getGroupId(time, source)),
      recordedAt: new Date(record.time).toISOString(),
      sourceAppPackage: source,
      weightKg: members.find(({ candidate }) => candidate.metric === "weight")?.candidate.value,
      bodyFatPercent: members.find(({ candidate }) => candidate.metric === "bodyFat")?.candidate.value
    });
  }
  return groups.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
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
