import { Feather } from "@expo/vector-icons";
import { router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BodyHealthConnectImportCard } from "@/components/body-health-connect-import-card";
import { BodyMeasurementSummaryCard } from "@/components/body-measurement-summary-card";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { BodyMeasurementEditorSheet } from "@/features/records/BodyMeasurementEditorSheet";
import {
  getBodyMeasurements,
  getBodyMeasurementSettings
} from "@/lib/body-measurement-library";
import {
  getBodyMeasurementMetricValue,
  getBodyMeasurementSeries,
  getBodyMeasurementSeriesSummary
} from "@/lib/body-measurement-series";
import { getBodyProjectById } from "@/lib/body-project-library";
import { useAppAppearance } from "@/lib/app-appearance";
import {
  bodyMeasurementMetricMeta,
  defaultBodyMeasurementSettings,
  type BodyMeasurementEntry,
  type BodyMeasurementMetric,
  type BodyMeasurementSettings
} from "@/types/body-measurement";
import type { BodyProject } from "@/types/body-project";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));

const getEnabledMetrics = (settings: BodyMeasurementSettings) =>
  (Object.keys(bodyMeasurementMetricMeta) as BodyMeasurementMetric[]).filter(
    (metric) => settings.fields[metric]
  );

export default function BodyMeasurementHistoryScreen() {
  const { id, add } = useLocalSearchParams<{
    id?: string | string[];
    add?: string | string[];
  }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const addRequested = Array.isArray(add) ? add[0] : add;
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const [project, setProject] = useState<BodyProject | null | undefined>(undefined);
  const [settings, setSettings] = useState<BodyMeasurementSettings>(
    defaultBodyMeasurementSettings
  );
  const [entries, setEntries] = useState<BodyMeasurementEntry[]>([]);
  const [selectedMetric, setSelectedMetric] =
    useState<BodyMeasurementMetric>("weight");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BodyMeasurementEntry | null>(
    null
  );
  const [newRecordedAt, setNewRecordedAt] = useState(() =>
    new Date().toISOString()
  );
  const handledAddRequestRef = useRef(false);

  const reload = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setEntries([]);
      return;
    }

    const [storedProject, storedSettings, storedEntries] = await Promise.all([
      getBodyProjectById(projectId),
      getBodyMeasurementSettings(projectId),
      getBodyMeasurements(projectId)
    ]);

    setProject(storedProject);
    setSettings(storedSettings);
    setEntries(storedEntries);

    const enabledMetrics = getEnabledMetrics(storedSettings);
    setSelectedMetric((current) =>
      enabledMetrics.includes(current)
        ? current
        : enabledMetrics.includes(storedSettings.primaryMetric)
          ? storedSettings.primaryMetric
          : enabledMetrics[0] ?? "weight"
    );

    if (
      addRequested === "1" &&
      storedSettings.enabled &&
      !handledAddRequestRef.current
    ) {
      handledAddRequestRef.current = true;
      setEditingEntry(null);
      setNewRecordedAt(new Date().toISOString());
      setEditorOpen(true);
    }
  }, [addRequested, projectId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const enabledMetrics = useMemo(() => getEnabledMetrics(settings), [settings]);
  const series = useMemo(
    () => getBodyMeasurementSeries(entries, selectedMetric),
    [entries, selectedMetric]
  );
  const seriesSummary = useMemo(
    () => getBodyMeasurementSeriesSummary(series),
    [series]
  );
  const visibleEntries = useMemo(
    () =>
      [...entries]
        .filter(
          (entry) =>
            getBodyMeasurementMetricValue(entry, selectedMetric) !== undefined
        )
        .sort(
          (a, b) =>
            new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        ),
    [entries, selectedMetric]
  );

  const openNewEntry = () => {
    setEditingEntry(null);
    setNewRecordedAt(new Date().toISOString());
    setEditorOpen(true);
  };

  const openEntry = (entry: BodyMeasurementEntry) => {
    setEditingEntry(entry);
    setNewRecordedAt(entry.recordedAt);
    setEditorOpen(true);
  };

  if (project === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.text} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>
          프로젝트를 찾을 수 없습니다.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={[styles.secondaryButton, { borderColor: palette.line }]}
          onPress={() => router.replace("/studio")}
        >
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
            기록으로 돌아가기
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!settings.enabled || enabledMetrics.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <View
          style={[
            styles.centered,
            {
              paddingTop: Math.max(insets.top + 24, 32),
              paddingBottom: insets.bottom + 24
            }
          ]}
        >
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            수치 기록을 사용하지 않는 프로젝트입니다.
          </Text>
          <Text style={[styles.emptyDetail, { color: palette.muted }]}>
            프로젝트 설정에서 수치 기록을 켜면 몸무게 등 원하는 값을 기록할 수 있습니다.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={[styles.secondaryButton, { borderColor: palette.line }]}
            onPress={() =>
              router.replace({
                pathname: "/project/[id]",
                params: { id: project.id }
              })
            }
          >
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
              프로젝트로 돌아가기
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const metricMeta = bodyMeasurementMetricMeta[selectedMetric];

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 12, 20),
            paddingBottom: insets.bottom + 36
          }
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로젝트로 돌아가기"
            style={[styles.iconButton, { borderColor: palette.line }]}
            onPress={() => router.back()}
          >
            <Feather name="chevron-left" size={24} color={palette.text} />
          </Pressable>
          <Text style={[styles.pageTitle, { color: palette.text }]}>
            수치 기록
          </Text>
          <Pressable
            accessibilityRole="button"
            style={[styles.addButton, { borderColor: palette.line }]}
            onPress={openNewEntry}
          >
            <Text style={[styles.addButtonText, { color: palette.text }]}>추가</Text>
          </Pressable>
        </View>

        <View style={styles.projectHeader}>
          <Text style={[styles.projectName, { color: palette.text }]}>
            {project.name}
          </Text>
          <Text style={[styles.projectDetail, { color: palette.muted }]}>
            직접 입력한 수치는 현재 기기에만 저장됩니다.
          </Text>
        </View>

        <BodyHealthConnectImportCard
          projectId={project.id}
          settings={settings}
          onImported={() => void reload()}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricSelector}
        >
          {enabledMetrics.map((metric) => {
            const active = selectedMetric === metric;
            return (
              <Pressable
                key={metric}
                accessibilityRole="button"
                style={[
                  styles.metricButton,
                  {
                    borderColor: active ? palette.text : palette.line,
                    backgroundColor: active ? palette.text : palette.surface
                  }
                ]}
                onPress={() => setSelectedMetric(metric)}
              >
                <Text
                  style={[
                    styles.metricButtonText,
                    { color: active ? palette.inverse : palette.text }
                  ]}
                >
                  {bodyMeasurementMetricMeta[metric].label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.overviewGrid}>
          <OverviewStat
            label="시작"
            value={
              seriesSummary.first
                ? String(seriesSummary.first.value) + metricMeta.unit
                : "-"
            }
            textColor={palette.text}
            mutedColor={palette.muted}
            borderColor={palette.line}
            backgroundColor={palette.surface}
          />
          <OverviewStat
            label="현재"
            value={
              seriesSummary.latest
                ? String(seriesSummary.latest.value) + metricMeta.unit
                : "-"
            }
            textColor={palette.text}
            mutedColor={palette.muted}
            borderColor={palette.line}
            backgroundColor={palette.surface}
          />
          <OverviewStat
            label="변화"
            value={
              seriesSummary.change === null
                ? "-"
                : (seriesSummary.change > 0 ? "+" : "") +
                  seriesSummary.change +
                  metricMeta.unit
            }
            textColor={palette.text}
            mutedColor={palette.muted}
            borderColor={palette.line}
            backgroundColor={palette.surface}
          />
          <OverviewStat
            label="기록"
            value={String(seriesSummary.count) + "회"}
            textColor={palette.text}
            mutedColor={palette.muted}
            borderColor={palette.line}
            backgroundColor={palette.surface}
          />
        </View>

        <BodyMeasurementSummaryCard
          metric={selectedMetric}
          series={series}
          onAddMeasurement={openNewEntry}
        />

        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              기록 목록
            </Text>
            <Text style={[styles.sectionCount, { color: palette.muted }]}>
              {visibleEntries.length}회
            </Text>
          </View>

          {visibleEntries.length > 0 ? (
            <View style={styles.historyList}>
              {visibleEntries.map((entry) => {
                const value = getBodyMeasurementMetricValue(
                  entry,
                  selectedMetric
                );
                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.historyRow,
                      {
                        borderColor: palette.line,
                        backgroundColor: palette.surface
                      }
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      style={styles.historyMain}
                      onPress={() => openEntry(entry)}
                    >
                      <View style={styles.historyCopy}>
                        <Text style={[styles.historyDate, { color: palette.text }]}>
                          {formatDate(entry.recordedAt)}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.historyMeta, { color: palette.muted }]}
                        >
                          {entry.sequence
                            ? "#" + entry.sequence + " 기록"
                            : "사진과 연결되지 않은 기록"}
                          {entry.note ? " · 메모 있음" : ""}
                          {entry.source === "health_connect"
                            ? " · Health Connect"
                            : ""}
                        </Text>
                      </View>
                      <Text style={[styles.historyValue, { color: palette.text }]}>
                        {value}
                        {metricMeta.unit}
                      </Text>
                    </Pressable>

                    {entry.photoId ? (
                      <Pressable
                        accessibilityRole="button"
                        style={styles.photoButton}
                        onPress={() =>
                          router.push(("/photo/" + entry.photoId) as Href)
                        }
                      >
                        <Text
                          style={[
                            styles.photoButtonText,
                            { color: palette.muted }
                          ]}
                        >
                          사진
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                { borderColor: palette.line, backgroundColor: palette.surface }
              ]}
            >
              <Text style={[styles.emptyDetail, { color: palette.muted }]}>
                아직 {metricMeta.label} 기록이 없습니다.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={[styles.secondaryButton, { borderColor: palette.line }]}
                onPress={openNewEntry}
              >
                <Text
                  style={[styles.secondaryButtonText, { color: palette.text }]}
                >
                  수치 기록 추가
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <BodyMeasurementEditorSheet
        visible={editorOpen}
        projectId={project.id}
        photoId={editingEntry?.photoId}
        sequence={editingEntry?.sequence}
        recordedAt={editingEntry?.recordedAt ?? newRecordedAt}
        settings={settings}
        entry={editingEntry}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          void reload();
        }}
        onDeleted={() => {
          setEditorOpen(false);
          void reload();
        }}
      />
    </View>
  );
}

function OverviewStat({
  label,
  value,
  textColor,
  mutedColor,
  borderColor,
  backgroundColor
}: {
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  backgroundColor: string;
}) {
  return (
    <View
      style={[
        styles.overviewStat,
        { borderColor, backgroundColor }
      ]}
    >
      <Text style={[styles.overviewLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.overviewValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    paddingHorizontal: bodyFrameDesign.horizontalPadding
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24
  },
  topBar: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20
  },
  iconButton: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  pageTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  addButton: {
    minWidth: bodyFrameDesign.minTouchSize,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  addButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  projectHeader: {
    gap: 5,
    marginBottom: 16
  },
  projectName: {
    fontSize: bodyFrameTypography.projectTitle,
    fontWeight: "600"
  },
  projectDetail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  metricSelector: {
    gap: 8,
    paddingBottom: 14
  },
  metricButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  metricButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12
  },
  overviewStat: {
    width: "48%",
    minHeight: 72,
    justifyContent: "space-between",
    padding: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  overviewLabel: {
    fontSize: bodyFrameTypography.caption
  },
  overviewValue: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  historySection: {
    gap: 12
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  sectionCount: {
    fontSize: bodyFrameTypography.caption
  },
  historyList: {
    gap: 8
  },
  historyRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius,
    overflow: "hidden"
  },
  historyMain: {
    minHeight: 68,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  historyCopy: {
    flex: 1,
    gap: 4
  },
  historyDate: {
    fontSize: bodyFrameTypography.body,
    fontWeight: "600"
  },
  historyMeta: {
    fontSize: bodyFrameTypography.caption
  },
  historyValue: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  photoButton: {
    minWidth: 52,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  photoButtonText: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  emptyCard: {
    gap: 12,
    padding: 16,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  emptyTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600",
    textAlign: "center"
  },
  emptyDetail: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 20,
    textAlign: "center"
  },
  secondaryButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  secondaryButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  }
});
