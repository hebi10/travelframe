import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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

function Sparkline({
  series,
  lineColor,
  mutedColor
}: {
  series: BodyMeasurementSeriesPoint[];
  lineColor: string;
  mutedColor: string;
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
  onOpenHistory
}: {
  metric: BodyMeasurementMetric;
  series: BodyMeasurementSeriesPoint[];
  onAddMeasurement?: () => void;
  onOpenHistory?: () => void;
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

  return (
    <View
      style={[
        styles.card,
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
            {changeText ? (
              <Text style={[styles.change, { color: palette.muted }]}>
                시작 대비 {changeText}
              </Text>
            ) : null}
          </View>
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
          <Sparkline
            series={series}
            lineColor={palette.text}
            mutedColor={palette.line}
          />
          <View style={styles.rangeRow}>
            <Text style={[styles.rangeText, { color: palette.faint }]}>
              시작
            </Text>
            <Text style={[styles.rangeText, { color: palette.faint }]}>
              최근
            </Text>
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
    justifyContent: "space-between"
  },
  rangeText: {
    fontSize: bodyFrameTypography.caption
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
