import type { BodyHealthConnectCandidate } from "@/lib/body-health-connect";
import type { BodyMeasurementEntry } from "@/types/body-measurement";
import type { PhotoItem } from "@/types/photo";

type ImportedMeasurement = Pick<BodyMeasurementEntry, "recordedAt" | "weightKg" | "bodyFatPercent" | "sourceAppPackage"> & {
  sourceRecordId: string;
  originalRecordIds: string[];
  legacyGroupIds: string[];
  savedEntryId?: string;
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
  group: Pick<ImportedMeasurement, "sourceRecordId" | "originalRecordIds" | "legacyGroupIds" | "savedEntryId">,
  savedEntries: readonly BodyMeasurementEntry[],
  matchedEntryIds: ReadonlySet<string>,
  reservedEntryIds: ReadonlySet<string> = new Set()
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
    !entry.sourceMemberIds?.length && entry.sourceRecordId && fallbackIds.has(entry.sourceRecordId) &&
    (!reservedEntryIds.has(entry.id) || entry.id === group.savedEntryId)
  );
  const existing = members.find((entry) => entry.photoId) ?? members[0] ??
    eligible.find((entry) => entry.id === group.savedEntryId) ??
    legacy.find((entry) => entry.sourceRecordId === group.sourceRecordId) ??
    legacy.find((entry) => entry.photoId) ?? legacy[0];
  return { existing, legacy };
};

const representedMetrics = (entry: Pick<BodyMeasurementEntry, "weightKg" | "bodyFatPercent" | "manualFields">) =>
  (["weight", "bodyFat"] as const).filter((metric) => {
    const field = metric === "weight" ? "weightKg" : "bodyFatPercent";
    return entry[field] !== undefined || entry.manualFields?.includes(field);
  });

// A legacy exact-time group has no per-metric identity until all of its
// represented metrics are available. Keep its legacy alias in that case.
export const getHealthConnectReservedEntryIds = (
  groups: readonly Pick<ImportedMeasurement, "savedEntryId">[]
) => new Set(groups.flatMap((group) => group.savedEntryId ? [group.savedEntryId] : []));

export const getHealthConnectSourceMemberIds = (
  existing: BodyMeasurementEntry | undefined,
  group: Pick<ImportedMeasurement, "originalRecordIds" | "weightKg" | "bodyFatPercent">
) => {
  const previous = existing?.sourceMemberIds ?? [];
  if (existing && previous.length === 0 &&
      representedMetrics(existing).some((metric) =>
        metric === "weight" ? group.weightKg === undefined : group.bodyFatPercent === undefined)) {
    return previous;
  }
  return [...new Set([...previous, ...group.originalRecordIds])];
};

export const groupBodyHealthConnectMeasurements = (
  candidates: readonly BodyHealthConnectCandidate[],
  savedEntries: readonly BodyMeasurementEntry[] = []
) => {
  const savedMemberOwners = new Map<string, string>();
  for (const entry of savedEntries) {
    if (entry.source !== "health_connect") continue;
    for (const id of entry.sourceMemberIds ?? []) savedMemberOwners.set(id, entry.id);
  }

  const records = candidates.map((candidate) => ({ candidate, time: Date.parse(candidate.recordedAt) }))
    .filter(({ time }) => Number.isFinite(time))
    .sort((a, b) => a.time - b.time);

  // Recover the pre-upgrade exact-time group while it lacks complete member
  // provenance. Never claim an identity already owned by another saved entry.
  const inferredOwners = new Map<string, Set<string>>();
  for (const entry of savedEntries) {
    if (entry.source !== "health_connect" || !entry.sourceRecordId) continue;
    const members = entry.sourceMemberIds ?? [];
    const metrics = representedMetrics(entry);
    if (members.length > 0 && members.length >= metrics.length) continue;
    const known = records.filter(({ candidate }) => members.includes(candidate.sourceRecordId));
    // A previously partially migrated record can be repaired only when its
    // known members are present, so a same-metric collision cannot be claimed.
    if (members.length > 0 && known.length !== members.length) continue;
    const knownMetrics = new Set(known.map(({ candidate }) => candidate.metric));
    for (const metric of ["weight", "bodyFat"] as const) {
      if (knownMetrics.has(metric) || (members.length > 0 && !metrics.includes(metric))) continue;
      const matches = records.filter(({ candidate, time }) =>
        candidate.metric === metric && !savedMemberOwners.has(candidate.sourceRecordId) &&
        (entry.sourceRecordId === getGroupId(time, candidate.sourceAppPackage) ||
         entry.sourceRecordId === candidate.sourceRecordId));
      const field = metric === "weight" ? "weightKg" : "bodyFatPercent";
      const sameValue = matches.filter(({ candidate }) => candidate.value === entry[field]);
      const match = sameValue.length === 1 ? sameValue[0] :
        matches.length === 1 && sameValue.length === 0 && members.length === 0 ? matches[0] : undefined;
      if (!match) continue;
      const owners = inferredOwners.get(match.candidate.sourceRecordId) ?? new Set<string>();
      owners.add(entry.id);
      inferredOwners.set(match.candidate.sourceRecordId, owners);
    }
  }
  for (const [memberId, owners] of inferredOwners) {
    if (owners.size === 1 && !savedMemberOwners.has(memberId)) {
      savedMemberOwners.set(memberId, [...owners][0]);
    }
  }

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
          savedMemberOwners.get(left.candidate.sourceRecordId) === savedMemberOwners.get(right.candidate.sourceRecordId)) {
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
      savedEntryId: savedMemberOwners.get(record.candidate.sourceRecordId),
      recordedAt: new Date(record.time).toISOString(),
      sourceAppPackage: source,
      weightKg: members.find(({ candidate }) => candidate.metric === "weight")?.candidate.value,
      bodyFatPercent: members.find(({ candidate }) => candidate.metric === "bodyFat")?.candidate.value
    });
  }
  return groups.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
};

export const findHealthConnectPhoto = (
  recordedAt: string,
  photos: readonly PhotoItem[],
  occupiedPhotoIds: ReadonlySet<string>,
  timeZone?: string
) => {
  const timestamp = Date.parse(recordedAt);
  if (!Number.isFinite(timestamp)) return undefined;
  const dayFormat = new Intl.DateTimeFormat("en-CA", {
    ...(timeZone ? { timeZone } : {}), year: "numeric", month: "2-digit", day: "2-digit"
  });
  const day = dayFormat.format(timestamp);
  return photos
    .filter((photo) => !occupiedPhotoIds.has(photo.id) &&
      Number.isFinite(Date.parse(photo.createdAt)) && dayFormat.format(new Date(photo.createdAt)) === day)
    .sort((a, b) =>
      Math.abs(Date.parse(a.createdAt) - timestamp) - Math.abs(Date.parse(b.createdAt) - timestamp) ||
      (a.sequence ?? 0) - (b.sequence ?? 0)
    )[0];
};
