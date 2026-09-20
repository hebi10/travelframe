import { Image } from "@/components/private-media-image";
import { BodyMeasurementSummaryCard } from "@/components/body-measurement-summary-card";
import { router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import {
  getBodyProjectPhotos,
  getBodyProjectProgressSummary
} from "@/lib/body-frame-camera-project";
import {
  archiveBodyProject,
  getBodyProjectById,
  updateBodyProject
} from "@/lib/body-project-library";
import {
  getBodyCaptureContextState,
  updateBodyCaptureContextEnabled
} from "@/lib/body-frame-capture-context";
import {
  getBodyPoseAlignmentSettings,
  updateBodyPoseAlignmentSettings
} from "@/lib/body-pose-alignment";
import {
  getBodyMeasurements,
  getBodyMeasurementSettings,
  updateBodyMeasurementSettings
} from "@/lib/body-measurement-library";
import { getBodyMeasurementSeries } from "@/lib/body-measurement-series";
import { setLastActiveProjectId } from "@/lib/body-project-preferences";
import {
  getBodyFrameUpgradeLabel,
  isBodyFrameProjectTargetAllowed
} from "@/lib/body-frame-plan-limits";
import { getPhotos } from "@/lib/photo-library";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import type { BodyProject, ReferencePhotoMode } from "@/types/body-project";
import {
  bodyMeasurementMetricMeta,
  defaultBodyMeasurementSettings,
  type BodyMeasurementEntry,
  type BodyMeasurementMetric,
  type BodyMeasurementSettings
} from "@/types/body-measurement";
import type { PhotoItem } from "@/types/photo";

const formatDuration = (seconds: number) =>
  seconds < 60
    ? `${seconds.toFixed(1)}초`
    : `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join(".");
};

const sortProjectPhotos = (photos: PhotoItem[]) =>
  [...photos].sort((first, second) => {
    const sequenceDiff = (second.sequence ?? 0) - (first.sequence ?? 0);
    if (sequenceDiff !== 0) {
      return sequenceDiff;
    }

    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });

export default function BodyFrameProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const { isLoggedIn, subscription } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const upgradePlanLabel = getBodyFrameUpgradeLabel(planEntitlements.tier);
  const [project, setProject] = useState<BodyProject | null | undefined>(undefined);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [targetDraft, setTargetDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [measurementSettings, setMeasurementSettings] =
    useState<BodyMeasurementSettings>(defaultBodyMeasurementSettings);
  const [measurementDraft, setMeasurementDraft] =
    useState<BodyMeasurementSettings>(defaultBodyMeasurementSettings);
  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>([]);
  const [rememberCaptureContext, setRememberCaptureContext] = useState(true);
  const [rememberCaptureContextDraft, setRememberCaptureContextDraft] =
    useState(true);
  const [poseAlignmentEnabled, setPoseAlignmentEnabled] = useState(false);
  const [poseAlignmentDraft, setPoseAlignmentDraft] = useState(false);

  const reload = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      return;
    }

    const [
      storedProject,
      storedPhotos,
      storedMeasurementSettings,
      storedMeasurements,
      storedCaptureContextState,
      storedPoseAlignmentSettings
    ] = await Promise.all([
      getBodyProjectById(projectId),
      getPhotos(),
      getBodyMeasurementSettings(projectId),
      getBodyMeasurements(projectId),
      getBodyCaptureContextState(projectId),
      getBodyPoseAlignmentSettings(projectId)
    ]);

    setProject(storedProject);
    setPhotos(storedPhotos);
    setMeasurementSettings(storedMeasurementSettings);
    setMeasurementDraft(storedMeasurementSettings);
    setMeasurements(storedMeasurements);
    setRememberCaptureContext(storedCaptureContextState.enabled);
    setRememberCaptureContextDraft(storedCaptureContextState.enabled);
    setPoseAlignmentEnabled(storedPoseAlignmentSettings.enabled);
    setPoseAlignmentDraft(storedPoseAlignmentSettings.enabled);
    if (storedProject) {
      setNameDraft(storedProject.name);
      setTargetDraft(String(storedProject.targetPhotoCount));
      await setLastActiveProjectId(storedProject.id);
    }
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const summary = useMemo(
    () => (project ? getBodyProjectProgressSummary(photos, project) : null),
    [photos, project]
  );

  const projectPhotos = useMemo(
    () =>
      project
        ? sortProjectPhotos(getBodyProjectPhotos(photos, project.id))
        : [],
    [photos, project]
  );

  const measurementSeries = useMemo(
    () =>
      measurementSettings.enabled
        ? getBodyMeasurementSeries(
            measurements,
            measurementSettings.primaryMetric
          )
        : [],
    [
      measurementSettings.enabled,
      measurementSettings.primaryMetric,
      measurements
    ]
  );

  const saveBasicInfo = useCallback(async () => {
    if (!project || saving) return;

    const target = Number.parseInt(targetDraft, 10);
    if (!nameDraft.trim()) {
      Alert.alert("프로젝트 이름", "프로젝트 이름을 입력해 주세요.");
      return;
    }
    if (!Number.isInteger(target) || target <= 0) {
      Alert.alert("목표 기록 수", "1 이상의 숫자를 입력해 주세요.");
      return;
    }

    if (
      measurementDraft.enabled &&
      !Object.values(measurementDraft.fields).some(Boolean)
    ) {
      Alert.alert("수치 기록", "기록할 수치를 하나 이상 선택해 주세요.");
      return;
    }

    if (
      target !== project.targetPhotoCount &&
      !isBodyFrameProjectTargetAllowed({
        targetPhotoCount: target,
        maxProgressPhotos: planEntitlements.maxProgressPhotos
      })
    ) {
      Alert.alert(
        "현재 플랜 한도",
        `${planEntitlements.label} 플랜에서는 프로젝트 목표를 최대 ${planEntitlements.maxProgressPhotos}장까지 설정할 수 있습니다.`
      );
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        updateBodyProject(project.id, {
          name: nameDraft.trim(),
          targetPhotoCount: target
        }),
        updateBodyMeasurementSettings(project.id, measurementDraft),
        updateBodyCaptureContextEnabled(
          project.id,
          rememberCaptureContextDraft
        ),
        updateBodyPoseAlignmentSettings(project.id, poseAlignmentDraft)
      ]);
      await reload();
      setSettingsOpen(false);
    } finally {
      setSaving(false);
    }
  }, [
    nameDraft,
    planEntitlements.label,
    planEntitlements.maxProgressPhotos,
    measurementDraft,
    rememberCaptureContextDraft,
    poseAlignmentDraft,
    project,
    reload,
    saving,
    targetDraft
  ]);

  const changeReferenceMode = useCallback(
    async (referenceMode: ReferencePhotoMode) => {
      if (!project || saving || project.referenceMode === referenceMode) return;
      setSaving(true);
      try {
        await updateBodyProject(project.id, { referenceMode });
        await reload();
      } finally {
        setSaving(false);
      }
    },
    [project, reload, saving]
  );

  const confirmArchive = useCallback(() => {
    if (!project) return;

    Alert.alert(
      "프로젝트 보관",
      `"${project.name}" 프로젝트를 보관하시겠습니까? 사진 파일은 삭제되지 않습니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "보관",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await archiveBodyProject(project.id, true);
              setSettingsOpen(false);
              router.back();
            })();
          }
        }
      ]
    );
  }, [project]);

  const openCamera = useCallback(async () => {
    if (!project) return;
    await setLastActiveProjectId(project.id);
    router.push("/camera");
  }, [project]);

  const openVideo = useCallback(async () => {
    if (!project) return;
    await setLastActiveProjectId(project.id);
    router.push("/trip-clip");
  }, [project]);

  if (project === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.text} />
      </View>
    );
  }

  if (!project || !summary) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>
          프로젝트를 찾을 수 없습니다.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={[styles.secondaryButton, { borderColor: palette.line }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
            돌아가기
          </Text>
        </Pressable>
      </View>
    );
  }

  const progress = Math.min(
    1,
    summary.photoCount / Math.max(1, summary.targetPhotoCount)
  );
  const progressPercent = Math.round(progress * 100);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 16, 24),
            paddingBottom: insets.bottom + 36
          }
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="기록으로 돌아가기"
            style={[styles.iconButton, { borderColor: palette.line }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: palette.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.pageTitle, { color: palette.text }]}>프로젝트</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로젝트 설정 열기"
            style={[styles.settingsButton, { borderColor: palette.line }]}
            onPress={() => {
              setMeasurementDraft(measurementSettings);
              setRememberCaptureContextDraft(rememberCaptureContext);
              setPoseAlignmentDraft(poseAlignmentEnabled);
              setSettingsOpen(true);
            }}
          >
            <Text style={[styles.settingsButtonText, { color: palette.text }]}>설정</Text>
          </Pressable>
        </View>

        <View style={styles.projectHeader}>
          <Text style={[styles.projectName, { color: palette.text }]}>
            {project.name}
          </Text>
          <View style={styles.progressHeading}>
            <Text style={[styles.progressCount, { color: palette.text }]}>
              {summary.photoCount} / {summary.targetPhotoCount}
            </Text>
            <Text style={[styles.progressPercent, { color: palette.muted }]}>
              {progressPercent}% 진행
            </Text>
          </View>
          <View
            style={[styles.progressTrack, { backgroundColor: palette.surfaceStrong }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: palette.text
                }
              ]}
            />
          </View>
        </View>

        {measurementSettings.enabled ? (
          <BodyMeasurementSummaryCard
            metric={measurementSettings.primaryMetric}
            series={measurementSeries}
            onOpenHistory={() =>
              router.push({
                pathname: "/project/[id]/measurements",
                params: { id: project.id }
              })
            }
            onAddMeasurement={
              projectPhotos[0]
                ? () =>
                    router.push({
                      pathname: "/photo/[id]",
                      params: {
                        id: projectPhotos[0].id,
                        measurement: "1"
                      }
                    })
                : () =>
                    router.push({
                      pathname: "/project/[id]/measurements",
                      params: { id: project.id, add: "1" }
                    })
            }
          />
        ) : null}

        <View style={styles.statGrid}>
          <View
            style={[
              styles.statCard,
              { borderColor: palette.line, backgroundColor: palette.surface }
            ]}
          >
            <Text style={[styles.statLabel, { color: palette.muted }]}>시작일</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>
              {formatDate(project.createdAt)}
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { borderColor: palette.line, backgroundColor: palette.surface }
            ]}
          >
            <Text style={[styles.statLabel, { color: palette.muted }]}>변화 영상</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>
              {formatDuration(summary.durationSeconds)}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          style={[styles.primaryAction, { backgroundColor: palette.text }]}
          onPress={() => void openCamera()}
        >
          <Text style={[styles.primaryActionText, { color: palette.inverse }]}>
            오늘 사진 찍기
          </Text>
        </Pressable>

        <View style={styles.recordsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>기록</Text>
            <Text style={[styles.sectionCount, { color: palette.muted }]}>
              {projectPhotos.length}장
            </Text>
          </View>

          {projectPhotos.length > 0 ? (
            <View style={styles.photoGrid}>
              {projectPhotos.map((photo) => (
                <Pressable
                  key={photo.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${photo.sequence ?? ""}번째 기록 ${formatDate(photo.createdAt)}`}
                  style={[
                    styles.photoTile,
                    {
                      borderColor: palette.line,
                      backgroundColor: palette.surfaceStrong
                    }
                  ]}
                  onPress={() => router.push(`/photo/${photo.id}` as Href)}
                >
                  <Image
                    source={{ uri: photo.previewUri ?? photo.uri }}
                    style={styles.photoImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  <View style={styles.photoMetaOverlay}>
                    <Text style={styles.photoMetaText}>
                      {photo.sequence ? `#${photo.sequence}` : "기록"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.emptyRecords,
                { borderColor: palette.line, backgroundColor: palette.surface }
              ]}
            >
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                아직 기록된 사진이 없습니다.
              </Text>
              <Text style={[styles.emptyDetail, { color: palette.muted }]}>
                첫 사진을 찍으면 이곳에 날짜순으로 기록이 쌓입니다.
              </Text>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          style={[styles.videoAction, { borderColor: palette.text }]}
          onPress={() => void openVideo()}
        >
          <Text style={[styles.videoActionText, { color: palette.text }]}>
            변화 영상 만들기
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={settingsOpen}
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSettingsOpen(false)}
        >
          <Pressable
            style={[
              styles.settingsSheet,
              {
                backgroundColor: palette.surface,
                borderColor: palette.line,
                paddingBottom: Math.max(insets.bottom, 16)
              }
            ]}
            onPress={() => undefined}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>
                프로젝트 설정
              </Text>
              <View style={styles.sheetActions}>
                <Pressable
                  disabled={saving}
                  accessibilityRole="button"
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: palette.text,
                      opacity: saving ? 0.5 : 1
                    }
                  ]}
                  onPress={() => void saveBasicInfo()}
                >
                  <Text style={[styles.saveButtonText, { color: palette.inverse }]}>
                    변경 저장
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.sheetCloseButton, { borderColor: palette.line }]}
                  onPress={() => setSettingsOpen(false)}
                >
                  <Text style={[styles.sheetCloseText, { color: palette.text }]}>닫기</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.settingsContent}
            >
              <Text style={[styles.label, { color: palette.muted }]}>이름</Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="프로젝트 이름"
                placeholderTextColor={palette.faint}
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    borderColor: palette.line,
                    backgroundColor: palette.background
                  }
                ]}
              />

              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: palette.muted }]}>목표 기록 수</Text>
                <Text style={[styles.limitLabel, { color: palette.faint }]}>
                  {planEntitlements.maxProgressPhotos === null
                    ? "제한 없음"
                    : `현재 플랜 최대 ${planEntitlements.maxProgressPhotos}장`}
                </Text>
              </View>
              <TextInput
                value={targetDraft}
                onChangeText={setTargetDraft}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={palette.faint}
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    borderColor: palette.line,
                    backgroundColor: palette.background
                  }
                ]}
              />
              {planEntitlements.maxProgressPhotos !== null &&
              Number.parseInt(targetDraft, 10) !== project.targetPhotoCount &&
              Number.parseInt(targetDraft, 10) > planEntitlements.maxProgressPhotos &&
              upgradePlanLabel ? (
                <Pressable
                  accessibilityRole="button"
                  style={[styles.upgradeButton, { borderColor: palette.line }]}
                  onPress={() => router.push("/account")}
                >
                  <Text style={[styles.upgradeButtonText, { color: palette.text }]}>
                    플랜 보기 · {upgradePlanLabel}
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.settingDivider} />

              <Text style={[styles.settingTitle, { color: palette.text }]}>
                기준 사진
              </Text>
              <Text style={[styles.settingDetail, { color: palette.muted }]}>
                촬영 화면에서 몸을 맞출 반투명 기준 사진을 선택합니다.
              </Text>
              <View style={styles.choiceRow}>
                {([
                  ["latest", "최근 사진"],
                  ["first", "첫 사진"]
                ] as const).map(([mode, label]) => {
                  const active = project.referenceMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      disabled={saving}
                      accessibilityRole="button"
                      onPress={() => void changeReferenceMode(mode)}
                      style={[
                        styles.choiceButton,
                        {
                          borderColor: active ? palette.text : palette.line,
                          backgroundColor: active ? palette.text : palette.background
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          { color: active ? palette.inverse : palette.text }
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.settingDivider} />

              <Text style={[styles.settingTitle, { color: palette.text }]}>
                촬영 설정 기억
              </Text>
              <Text style={[styles.settingDetail, { color: palette.muted }]}>
                이 프로젝트의 카메라 방향, 비율, 확대, 노출과 색감을 기억합니다. 라이트와 타이머는 자동으로 복원하지 않습니다.
              </Text>
              <View style={styles.choiceRow}>
                {([
                  [false, "사용 안 함"],
                  [true, "사용"]
                ] as const).map(([enabled, label]) => {
                  const active = rememberCaptureContextDraft === enabled;
                  return (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      style={[
                        styles.choiceButton,
                        {
                          borderColor: active ? palette.text : palette.line,
                          backgroundColor: active
                            ? palette.text
                            : palette.background
                        }
                      ]}
                      onPress={() => setRememberCaptureContextDraft(enabled)}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          { color: active ? palette.inverse : palette.text }
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.settingDivider} />

              <Text style={[styles.settingTitle, { color: palette.text }]}>
                자세 맞춤 도움
              </Text>
              <Text style={[styles.settingDetail, { color: palette.muted }]}>
                기준 사진과 현재 자세를 기기에서만 분석해 위치를 맞추는 안내를 표시합니다. 첫 기록 이후 사용할 수 있으며 분석 이미지는 서버로 전송하지 않습니다.
              </Text>
              <View style={styles.choiceRow}>
                {([
                  [false, "사용 안 함"],
                  [true, "사용"]
                ] as const).map(([enabled, label]) => {
                  const active = poseAlignmentDraft === enabled;
                  return (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      style={[
                        styles.choiceButton,
                        {
                          borderColor: active ? palette.text : palette.line,
                          backgroundColor: active
                            ? palette.text
                            : palette.background
                        }
                      ]}
                      onPress={() => setPoseAlignmentDraft(enabled)}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          { color: active ? palette.inverse : palette.text }
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.settingHint, { color: palette.faint }]}>
                실험 기능 · 기기 성능에 따라 분석이 자동으로 중단될 수 있습니다.
              </Text>

              <View style={styles.settingDivider} />

              <Text style={[styles.settingTitle, { color: palette.text }]}>
                수치 기록
              </Text>
              <Text style={[styles.settingDetail, { color: palette.muted }]}>
                원하는 경우에만 몸무게 같은 수치를 사진 기록과 함께 저장합니다. 현재 기기에만 저장됩니다.
              </Text>
              <View style={styles.choiceRow}>
                {([
                  [false, "사용 안 함"],
                  [true, "사용"]
                ] as const).map(([enabled, label]) => {
                  const active = measurementDraft.enabled === enabled;
                  return (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      style={[
                        styles.choiceButton,
                        {
                          borderColor: active ? palette.text : palette.line,
                          backgroundColor: active ? palette.text : palette.background
                        }
                      ]}
                      onPress={() =>
                        setMeasurementDraft((current) => ({ ...current, enabled }))
                      }
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          { color: active ? palette.inverse : palette.text }
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {measurementDraft.enabled ? (
                <>
                  <Text style={[styles.label, { color: palette.muted }]}>
                    기록 항목
                  </Text>
                  <View style={styles.metricChoiceGrid}>
                    {(Object.keys(bodyMeasurementMetricMeta) as BodyMeasurementMetric[]).map(
                      (metric) => {
                        const active = measurementDraft.fields[metric];
                        return (
                          <Pressable
                            key={metric}
                            accessibilityRole="button"
                            style={[
                              styles.metricChoice,
                              {
                                borderColor: active ? palette.text : palette.line,
                                backgroundColor: active
                                  ? palette.surfaceStrong
                                  : palette.background
                              }
                            ]}
                            onPress={() =>
                              setMeasurementDraft((current) => ({
                                ...current,
                                fields: {
                                  ...current.fields,
                                  [metric]: !current.fields[metric]
                                }
                              }))
                            }
                          >
                            <Text style={[styles.metricChoiceText, { color: palette.text }]}>
                              {bodyMeasurementMetricMeta[metric].label}
                            </Text>
                          </Pressable>
                        );
                      }
                    )}
                  </View>

                  <Text style={[styles.label, { color: palette.muted }]}>
                    대표 수치
                  </Text>
                  <View style={styles.metricChoiceGrid}>
                    {(Object.keys(bodyMeasurementMetricMeta) as BodyMeasurementMetric[])
                      .filter((metric) => measurementDraft.fields[metric])
                      .map((metric) => {
                        const active = measurementDraft.primaryMetric === metric;
                        return (
                          <Pressable
                            key={metric}
                            accessibilityRole="button"
                            style={[
                              styles.metricChoice,
                              {
                                borderColor: active ? palette.text : palette.line,
                                backgroundColor: active
                                  ? palette.text
                                  : palette.background
                              }
                            ]}
                            onPress={() =>
                              setMeasurementDraft((current) => ({
                                ...current,
                                primaryMetric: metric
                              }))
                            }
                          >
                            <Text
                              style={[
                                styles.metricChoiceText,
                                { color: active ? palette.inverse : palette.text }
                              ]}
                            >
                              {bodyMeasurementMetricMeta[metric].label}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>

                  <Text style={[styles.label, { color: palette.muted }]}>
                    촬영 후 기록 제안
                  </Text>
                  <View style={styles.choiceRow}>
                    {([
                      [false, "끔"],
                      [true, "켬"]
                    ] as const).map(([enabled, label]) => {
                      const active = measurementDraft.promptAfterCapture === enabled;
                      return (
                        <Pressable
                          key={label}
                          accessibilityRole="button"
                          style={[
                            styles.choiceButton,
                            {
                              borderColor: active ? palette.text : palette.line,
                              backgroundColor: active ? palette.text : palette.background
                            }
                          ]}
                          onPress={() =>
                            setMeasurementDraft((current) => ({
                              ...current,
                              promptAfterCapture: enabled
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.choiceText,
                              { color: active ? palette.inverse : palette.text }
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <View style={styles.settingDivider} />

              <Text style={[styles.settingTitle, { color: palette.text }]}>
                프로젝트 관리
              </Text>
              <Text style={[styles.settingDetail, { color: palette.muted }]}>
                보관하면 기록 탭과 촬영 프로젝트 선택 목록에서 숨겨집니다. 사진 파일은 유지됩니다.
              </Text>
              <Pressable
                disabled={saving}
                accessibilityRole="button"
                style={[styles.archiveButton, { borderColor: palette.line }]}
                onPress={confirmArchive}
              >
                <Text style={[styles.archiveText, { color: palette.text }]}>
                  프로젝트 보관
                </Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    marginBottom: 22
  },
  iconButton: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  backButtonText: {
    marginTop: -2,
    fontSize: 28,
    fontWeight: "400"
  },
  pageTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  settingsButton: {
    minWidth: 54,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  settingsButtonText: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  projectHeader: {
    gap: 12,
    marginBottom: 20
  },
  projectName: {
    fontSize: bodyFrameTypography.projectTitle,
    lineHeight: 31,
    fontWeight: "600"
  },
  progressHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12
  },
  progressCount: {
    fontSize: bodyFrameTypography.metric,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  progressPercent: {
    fontSize: bodyFrameTypography.body,
    fontVariant: ["tabular-nums"]
  },
  progressTrack: {
    height: 5,
    overflow: "hidden",
    borderRadius: 3
  },
  progressFill: {
    height: "100%",
    borderRadius: 3
  },
  statGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  statCard: {
    flex: 1,
    minHeight: 76,
    justifyContent: "space-between",
    padding: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  statLabel: {
    fontSize: bodyFrameTypography.caption
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600"
  },
  primaryAction: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: bodyFrameDesign.buttonRadius,
    marginBottom: 28
  },
  primaryActionText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  },
  recordsSection: {
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
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8
  },
  photoTile: {
    width: "31%",
    aspectRatio: 3 / 4,
    overflow: "hidden",
    position: "relative",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  photoImage: {
    width: "100%",
    height: "100%"
  },
  photoMetaOverlay: {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 4,
    minHeight: 22,
    justifyContent: "center",
    paddingHorizontal: 5,
    backgroundColor: "rgba(0,0,0,0.62)"
  },
  photoMetaText: {
    color: "#F5F5F5",
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600",
    textAlign: "center",
    fontVariant: ["tabular-nums"]
  },
  emptyRecords: {
    gap: 6,
    padding: 16,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  videoAction: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  videoActionText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)"
  },
  settingsSheet: {
    width: "100%",
    maxHeight: "86%",
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingTop: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderTopLeftRadius: bodyFrameDesign.bottomSheetRadius,
    borderTopRightRadius: bodyFrameDesign.bottomSheetRadius
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginBottom: 14,
    backgroundColor: "#3A3A3E"
  },
  sheetHeader: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10
  },
  sheetTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600"
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sheetCloseButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  sheetCloseText: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  settingsContent: {
    gap: 10,
    paddingBottom: 16
  },
  labelRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  label: {
    fontSize: bodyFrameTypography.caption
  },
  limitLabel: {
    fontSize: bodyFrameTypography.caption
  },
  input: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius,
    fontSize: 15
  },
  upgradeButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  upgradeButtonText: {
    fontSize: 13,
    fontWeight: "600"
  },
  settingDivider: {
    height: 12
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600"
  },
  settingDetail: {
    fontSize: 13,
    lineHeight: 19
  },
  settingHint: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8
  },
  choiceButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  choiceText: {
    fontSize: 13,
    fontWeight: "600"
  },
  metricChoiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metricChoice: {
    minWidth: "47%",
    minHeight: bodyFrameDesign.minTouchSize,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  metricChoiceText: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  saveButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: bodyFrameDesign.buttonRadius,
    paddingHorizontal: 12
  },
  saveButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  },
  archiveButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  archiveText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600"
  },
  emptyDetail: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 20
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
    fontSize: 13,
    fontWeight: "600"
  }
});
