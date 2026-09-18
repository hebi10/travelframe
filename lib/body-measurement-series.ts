import type {
  BodyMeasurementEntry,
  BodyMeasurementMetric
} from "@/types/body-measurement";

export type BodyMeasurementSeriesPoint = {
  id: string;
  recordedAt: string;
  value: number;
};

export const getBodyMeasurementMetricValue = (
  entry: BodyMeasurementEntry,
  metric: BodyMeasurementMetric
) => {
  if (metric === "weight") return entry.weightKg;
  if (metric === "bodyFat") return entry.bodyFatPercent;
  if (metric === "skeletalMuscle") return entry.skeletalMuscleKg;
  return entry.waistCm;
};

export const getBodyMeasurementSeries = (
  entries: BodyMeasurementEntry[],
  metric: BodyMeasurementMetric
): BodyMeasurementSeriesPoint[] =>
  entries
    .map((entry) => {
      const value = getBodyMeasurementMetricValue(entry, metric);
      return value === undefined
        ? null
        : {
            id: entry.id,
            recordedAt: entry.recordedAt,
            value
          };
    })
    .filter((point): point is BodyMeasurementSeriesPoint => Boolean(point))
    .sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

export const getBodyMeasurementSeriesSummary = (
  series: BodyMeasurementSeriesPoint[]
) => {
  const first = series[0] ?? null;
  const latest = series.at(-1) ?? null;

  return {
    count: series.length,
    first,
    latest,
    change:
      first && latest ? Number((latest.value - first.value).toFixed(2)) : null
  };
};

export const normalizeBodyMeasurementSparklinePoints = ({
  series,
  width,
  height,
  horizontalPadding = 6,
  verticalPadding = 8
}: {
  series: BodyMeasurementSeriesPoint[];
  width: number;
  height: number;
  horizontalPadding?: number;
  verticalPadding?: number;
}) => {
  if (series.length === 0 || width <= 0 || height <= 0) {
    return [];
  }

  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const drawableWidth = Math.max(0, width - horizontalPadding * 2);
  const drawableHeight = Math.max(0, height - verticalPadding * 2);

  return series.map((point, index) => {
    const x =
      series.length <= 1
        ? width / 2
        : horizontalPadding + (drawableWidth * index) / (series.length - 1);
    const normalizedY = range === 0 ? 0.5 : (point.value - min) / range;
    const y = verticalPadding + drawableHeight * (1 - normalizedY);

    return {
      ...point,
      x,
      y
    };
  });
};
