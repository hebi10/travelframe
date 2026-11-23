import { Platform } from "react-native";
import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
  type RecordType,
  type ReadRecordsOptions,
  type RecordResult
} from "react-native-health-connect";

export type BodyHealthConnectMetric = "weight" | "bodyFat";

export type BodyHealthConnectAvailability =
  | "available"
  | "update_required"
  | "unavailable"
  | "unsupported_platform";

export type BodyHealthConnectCandidate = {
  metric: BodyHealthConnectMetric;
  value: number;
  recordedAt: string;
  sourceRecordId: string;
  sourceAppPackage?: string;
};

const HEALTH_CONNECT_READ_PERMISSIONS: Record<
  BodyHealthConnectMetric,
  Permission
> = {
  weight: { accessType: "read", recordType: "Weight" },
  bodyFat: { accessType: "read", recordType: "BodyFat" }
};

const getRequestedPermissions = (metrics: BodyHealthConnectMetric[]) =>
  metrics.map((metric) => HEALTH_CONNECT_READ_PERMISSIONS[metric]);

const hasPermission = (
  granted: Permission[],
  permission: Permission
) =>
  granted.some(
    (item) =>
      item.accessType === permission.accessType &&
      item.recordType === permission.recordType
  );

const toAvailability = (status: number): BodyHealthConnectAvailability => {
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
    return "available";
  }
  if (
    status ===
    SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
  ) {
    return "update_required";
  }
  return "unavailable";
};

const createFallbackRecordId = ({
  metric,
  recordedAt,
  value,
  sourceAppPackage
}: Omit<BodyHealthConnectCandidate, "sourceRecordId">) =>
  [metric, recordedAt, String(value), sourceAppPackage ?? "unknown"].join("|");

const toWeightCandidate = (
  record: RecordResult<"Weight">
): BodyHealthConnectCandidate | null => {
  const value = record.weight?.inKilograms;
  if (!Number.isFinite(value) || value < 20 || value > 500) return null;

  const sourceAppPackage = record.metadata?.dataOrigin;
  const base = {
    metric: "weight" as const,
    value: Number(value.toFixed(2)),
    recordedAt: record.time,
    ...(sourceAppPackage ? { sourceAppPackage } : {})
  };

  return {
    ...base,
    sourceRecordId:
      record.metadata?.id ??
      createFallbackRecordId(base)
  };
};

const toBodyFatCandidate = (
  record: RecordResult<"BodyFat">
): BodyHealthConnectCandidate | null => {
  const value = record.percentage;
  if (!Number.isFinite(value) || value < 1 || value > 70) return null;

  const sourceAppPackage = record.metadata?.dataOrigin;
  const base = {
    metric: "bodyFat" as const,
    value: Number(value.toFixed(2)),
    recordedAt: record.time,
    ...(sourceAppPackage ? { sourceAppPackage } : {})
  };

  return {
    ...base,
    sourceRecordId:
      record.metadata?.id ??
      createFallbackRecordId(base)
  };
};

const readAll = async <T extends RecordType>(recordType: T, options: ReadRecordsOptions) => {
  const records: RecordResult<T>[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  do {
    const page = await readRecords(recordType, { ...options, pageToken });
    records.push(...page.records);
    pageToken = page.pageToken;
    if (pageToken && seenTokens.has(pageToken)) throw new Error("Health Connect 기록을 이어서 읽지 못했습니다.");
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);
  return records;
};

export const getBodyHealthConnectAvailability = async () => {
  if (Platform.OS !== "android") {
    return "unsupported_platform" as const;
  }

  const status = await getSdkStatus();
  return toAvailability(status);
};

export const getBodyHealthConnectPermissionState = async (
  metrics: BodyHealthConnectMetric[]
) => {
  if (metrics.length === 0) return true;
  if ((await getBodyHealthConnectAvailability()) !== "available") {
    return false;
  }

  const initialized = await initialize();
  if (!initialized) return false;

  const granted = await getGrantedPermissions();
  const requested = getRequestedPermissions(metrics);
  return requested.every((permission) =>
    hasPermission(granted as Permission[], permission)
  );
};

export const requestBodyHealthConnectReadPermissions = async (
  metrics: BodyHealthConnectMetric[]
) => {
  if (metrics.length === 0) return true;
  if ((await getBodyHealthConnectAvailability()) !== "available") {
    return false;
  }

  const initialized = await initialize();
  if (!initialized) return false;

  const requested = getRequestedPermissions(metrics);
  const granted = await requestPermission(requested);
  return requested.every((permission) =>
    hasPermission(granted as Permission[], permission)
  );
};

export const readBodyHealthConnectMeasurements = async ({
  metrics,
  days = 30
}: {
  metrics: BodyHealthConnectMetric[];
  days?: number;
}) => {
  if (metrics.length === 0) return [] as BodyHealthConnectCandidate[];
  if ((await getBodyHealthConnectAvailability()) !== "available") {
    return [] as BodyHealthConnectCandidate[];
  }

  const initialized = await initialize();
  if (!initialized) {
    return [] as BodyHealthConnectCandidate[];
  }

  const endTime = new Date();
  const startTime = new Date(
    endTime.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000
  );
  const timeRangeFilter = {
    operator: "between" as const,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  };

  const options = { timeRangeFilter, ascendingOrder: false, pageSize: 100 };
  const [weights, bodyFat] = await Promise.all([
    metrics.includes("weight") ? readAll("Weight", options) : [],
    metrics.includes("bodyFat") ? readAll("BodyFat", options) : []
  ]);
  const candidates = [...weights.map(toWeightCandidate), ...bodyFat.map(toBodyFatCandidate)]
    .filter((candidate): candidate is BodyHealthConnectCandidate =>
      Boolean(candidate && Number.isFinite(Date.parse(candidate.recordedAt))));
  return candidates.sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() -
      new Date(a.recordedAt).getTime()
  );
};

export const openBodyHealthConnectSettings = () => {
  if (Platform.OS !== "android") return;
  openHealthConnectSettings();
};
