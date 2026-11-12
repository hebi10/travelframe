import { AppText as Text } from "@/components/app-text";
import {
  useMemo,
  useState } from "react";
import { Pressable,
  StyleSheet,
  View
} from "react-native";

import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import {
  getBodyMeasurementSeriesSummary,
  normalizeBodyMeasurementSparklinePoints,
  type BodyMeasurementSeriesPoint
} from "@/lib/body-measurement-series";
import { useAppAppearance } from "@/lib/app-appearance";
import {
  bodyMeasurementMetricMeta,
  type BodyMeasurementMetric
} from "@/types/body-measurement";

const CHART_HEIGHT = 92;
const POINT_SIZE = 6;
const LINE_HEIGHT = 2;

const formatRangeDate = (recordedAt: string) => {
  const date = new Date(recordedAt);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "numeric",
        day: "numeric"
      }).format(date)
    : "";
};

function Sparkline({
  series,
  lineColor,
  mutedColor,
  metricLabel,
  unit
}: {
  series: BodyMeasurementSeriesPoint[];
  lineColor: string;
  mutedColor: string;
  metricLabel: string;
  unit: string;
}) {
  const [width, setWidth] = useState(0);
  const points = useMemo(
    () =>
      normalizeBodyMeasurementSparklinePoints({
        series,
        width,
        height: CHART_HEIGHT
      }),
    [series, width]
  );

  return (
    <View
      style={styles.chart}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${metricLabel} 변화 그래프, 시작 ${series[0]?.value}${unit}, 최근 ${series[series.length - 1]?.value}${unit}, 총 ${series.length}회 기록`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={[styles.chartGuide, { backgroundColor: mutedColor }]} />

      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        return (
          <View
            key={`${point.id}-line`}
            style={[
              styles.chartLine,
              {
                left: (point.x + next.x) / 2 - length / 2,
                top: (point.y + next.y) / 2 - LINE_HEIGHT / 2,
                width: length,
                backgroundColor: lineColor,
                transform: [{ rotateZ: `${angle}rad` }]
              }
            ]}
          />
        );
      })}

      {points.map((point) => (
        <View
          key={point.id}
          style={[
            styles.chartPoint,
            {
              left: point.x - POINT_SIZE / 2,
              top: point.y - POINT_SIZE / 2,
              backgroundColor: lineColor
            }
          ]}
        />
      ))}
    </View>
  );
}

export function BodyMeasurementSummaryCard({
  metric,
  series,
  onAddMeasurement,
  onOpenHistory,
  compact = false
}: {
  metric: BodyMeasurementMetric;
  series: BodyMeasurementSeriesPoint[];
  onAddMeasurement?: () => void;
  onOpenHistory?: () => void;
  compact?: boolean;
}) {
  const { palette } = useAppAppearance();
  const meta = bodyMeasurementMetricMeta[metric];
  const summary = getBodyMeasurementSeriesSummary(series);
  const currentValue = summary.latest?.value;
  const change = summary.change;
  const changeText =
    change === null
      ? null
      : `${change > 0 ? "+" : ""}${change}${meta.unit}`;
  const range = useMemo(() => {
    if (series.length < 2) return null;
    const values = series.map((point) => point.value);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [series]);

  return (
    <View
      style={[
        styles.card,
        compact && styles.compactCard,
        {
          borderColor: palette.line,
          backgroundColor: palette.surface
        }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.label, { color: palette.muted }]}>
            {meta.label}
          </Text>
          <View style={styles.valueRow}>
            <Text style={[styles.value, { color: palette.text }]}>
              {currentValue === undefined
                ? "기록 없음"
                : `${currentValue}${meta.unit}`}
            </Text>
            {!compact && changeText ? (
              <Text style={[styles.change, { color: palette.muted }]}>
                시작 대비 {changeText}
              </Text>
            ) : null}
          </View>
          {compact && changeText ? (
            <Text style={[styles.compactChange, { color: palette.text }]}>
              시작 대비 {changeText}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <Text style={[styles.count, { color: palette.faint }]}>
            {summary.count}회
          </Text>
          {onOpenHistory ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.historyButton, { borderColor: palette.line }]}
              onPress={onOpenHistory}
            >
              <Text style={[styles.historyButtonText, { color: palette.text }]}>
                전체 보기
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {series.length >= 2 ? (
        <>
          {compact && range ? (
            <View style={styles.chartContext}>
              <Text style={[styles.chartContextText, { color: palette.muted }]}>
                변화 추이
              </Text>
              <Text style={[styles.chartContextText, { color: palette.muted }]}>
                최저 {range.min}{meta.unit} · 최고 {range.max}{meta.unit}
              </Text>
            </View>
          ) : null}
          <Sparkline
            series={series}
            lineColor={palette.text}
            mutedColor={palette.line}
            metricLabel={meta.label}
            unit={meta.unit}
          />
          <View style={styles.rangeRow}>
            <View style={styles.rangeEndpoint}>
              <Text style={[styles.rangeText, { color: palette.muted }]}>
                {compact && summary.first
                  ? `시작 ${formatRangeDate(summary.first.recordedAt)}`
                  : "시작"}
              </Text>
              {compact && summary.first ? (
                <Text style={[styles.rangeValue, { color: palette.text }]}>
                  {summary.first.value}{meta.unit}
                </Text>
              ) : null}
            </View>
            <View style={[styles.rangeEndpoint, styles.rangeEndpointEnd]}>
              <Text style={[styles.rangeText, { color: palette.muted }]}>
                {compact && summary.latest
                  ? `최근 ${formatRangeDate(summary.latest.recordedAt)}`
                  : "최근"}
              </Text>
              {compact && summary.latest ? (
                <Text style={[styles.rangeValue, { color: palette.text }]}>
                  {summary.latest.value}{meta.unit}
                </Text>
              ) : null}
            </View>
          </View>
        </>
      ) : series.length === 1 ? (
        <View style={styles.singleState}>
          <Text style={[styles.singleStateText, { color: palette.muted }]}>
            기록이 하나 더 쌓이면 변화 선이 표시됩니다.
          </Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: palette.muted }]}>
            아직 {meta.label} 기록이 없습니다.
          </Text>
          {onAddMeasurement ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.addButton, { borderColor: palette.line }]}
              onPress={onAddMeasurement}
            >
              <Text style={[styles.addButtonText, { color: palette.text }]}>
                수치 기록 추가
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    marginBottom: 16,
    padding: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  compactCard: {
    gap: 8,
    marginBottom: 8,
    padding: 12
  },
  header: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  headerCopy: {
    flex: 1,
    gap: 4
  },
  label: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  valueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 8
  },
  value: {
    fontSize: bodyFrameTypography.metric,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  change: {
    fontSize: bodyFrameTypography.caption,
    fontVariant: ["tabular-nums"]
  },
  compactChange: {
    fontSize: bodyFrameTypography.body,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  chartContext: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4
  },
  chartContextText: {
    fontSize: bodyFrameTypography.caption,
    fontVariant: ["tabular-nums"]
  },
  count: {
    fontSize: bodyFrameTypography.caption,
    fontVariant: ["tabular-nums"]
  },
  headerActions: {
    alignItems: "flex-end",
    gap: 6
  },
  historyButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  historyButtonText: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  chart: {
    position: "relative",
    width: "100%",
    height: CHART_HEIGHT,
    overflow: "hidden"
  },
  chartGuide: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CHART_HEIGHT / 2,
    height: 1,
    opacity: 0.65
  },
  chartLine: {
    position: "absolute",
    height: LINE_HEIGHT,
  },
  chartPoint: {
    position: "absolute",
    width: POINT_SIZE,
    height: POINT_SIZE,
    borderRadius: POINT_SIZE / 2
  },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  rangeEndpoint: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  rangeEndpointEnd: {
    alignItems: "flex-end"
  },
  rangeText: {
    fontSize: bodyFrameTypography.caption
  },
  rangeValue: {
    fontSize: bodyFrameTypography.body,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  singleState: {
    minHeight: 54,
    justifyContent: "center"
  },
  singleStateText: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 20
  },
  emptyState: {
    gap: 10,
    paddingTop: 4
  },
  emptyText: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 20
  },
  addButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  addButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  }
});
