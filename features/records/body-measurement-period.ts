export type BodyMeasurementPeriod = "1m" | "3m" | "6m" | "all";

const PERIOD_MONTHS: Record<Exclude<BodyMeasurementPeriod, "all">, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6
};

export const getBodyMeasurementPeriodStart = (
  period: BodyMeasurementPeriod,
  referenceDate = new Date()
): number | null => {
  if (period === "all") return null;
  const cutoff = new Date(referenceDate);
  const originalDay = cutoff.getDate();
  cutoff.setDate(1);
  cutoff.setMonth(cutoff.getMonth() - PERIOD_MONTHS[period]);
  const lastDay = new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate();
  cutoff.setDate(Math.min(originalDay, lastDay));
  cutoff.setHours(0, 0, 0, 0);
  return cutoff.getTime();
};

export const isBodyMeasurementInPeriod = (
  recordedAt: string,
  period: BodyMeasurementPeriod,
  referenceDate = new Date()
): boolean => {
  const recordedTime = new Date(recordedAt).getTime();
  if (!Number.isFinite(recordedTime)) return false;
  const start = getBodyMeasurementPeriodStart(period, referenceDate);
  return start === null || recordedTime >= start;
};
