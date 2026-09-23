import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
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
import { getBodyProjectProgressSummary } from "@/lib/body-frame-camera-project";
import {
  getBodyFrameProjectCreationLimitState,
  isBodyFrameProjectTargetAllowed
} from "@/lib/body-frame-plan-limits";
import type { BodyProject, ReferencePhotoMode } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

type CreateProjectInput = {
  name: string;
  targetPhotoCount: number;
  referenceMode: ReferencePhotoMode;
};

type BodyFrameProjectSwitcherProps = {
  projects: BodyProject[];
  photos: PhotoItem[];
  activeProject: BodyProject | null;
  disabled?: boolean;
  maxProgressPhotos?: number | null;
  maxProjectCount?: number | null;
  upgradePlanLabel?: string | null;
  onSelectProject: (project: BodyProject) => void;
  onCreateProject: (input: CreateProjectInput) => Promise<void> | void;
  onUpgrade?: () => void;
  onManageProjects?: () => void;
  compact?: boolean;
  createOnly?: boolean;
};

const formatDuration = (seconds: number) =>
  Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);

export function BodyFrameProjectSwitcher({
  projects,
  photos,
  activeProject,
  disabled = false,
  maxProgressPhotos = null,
  maxProjectCount = null,
  upgradePlanLabel = null,
  onSelectProject,
  onCreateProject,
  onUpgrade,
  onManageProjects,
  compact = false,
  createOnly = false
}: BodyFrameProjectSwitcherProps) {
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("새 프로젝트");
  const [targetPreset, setTargetPreset] = useState<"100" | "365" | "custom">("100");
  const [customTarget, setCustomTarget] = useState("100");
  const [referenceMode, setReferenceMode] = useState<ReferencePhotoMode>("latest");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const activeSummary = useMemo(
    () =>
      activeProject
        ? getBodyProjectProgressSummary(photos, activeProject)
        : null,
    [activeProject, photos]
  );

  const visibleProjects = useMemo(
    () => projects.filter((project) => !project.archived),
    [projects]
  );
  const projectLimitState = useMemo(
    () =>
      getBodyFrameProjectCreationLimitState({
        activeProjectCount: visibleProjects.length,
        maxProjectCount
      }),
    [maxProjectCount, visibleProjects.length]
  );

  const closeAll = () => {
    setPickerOpen(false);
    setCreateOpen(false);
  };

  const openCreateSheet = () => {
    setPickerOpen(false);
    setCreateOpen(true);
    if (!projectLimitState.allowed) {
      setCreateError(
        `현재 플랜에서는 프로젝트를 최대 ${projectLimitState.limit ?? visibleProjects.length}개까지 만들 수 있습니다.`
      );
      return;
    }
    setCreateError(null);
  };

  const submitProject = async () => {
    if (submitting) {
      return;
    }

    if (!projectLimitState.allowed) {
      setCreateError(
        `현재 플랜에서는 프로젝트를 최대 ${projectLimitState.limit ?? visibleProjects.length}개까지 만들 수 있습니다.`
      );
      return;
    }

    const parsedCustom = Number(customTarget);
    const targetPhotoCount =
      targetPreset === "365"
        ? 365
        : targetPreset === "custom"
          ? Math.max(1, Math.floor(Number.isFinite(parsedCustom) ? parsedCustom : 100))
          : 100;

    if (
      !isBodyFrameProjectTargetAllowed({
        targetPhotoCount,
        maxProgressPhotos
      })
    ) {
      setCreateError(
        `현재 플랜에서는 프로젝트 목표를 최대 ${maxProgressPhotos ?? targetPhotoCount}장까지 설정할 수 있습니다.`
      );
      return;
    }

    setCreateError(null);
    setSubmitting(true);
    try {
      await onCreateProject({
        name: name.trim() || "새 프로젝트",
        targetPhotoCount,
        referenceMode
      });
      closeAll();
      setName("새 프로젝트");
      setTargetPreset("100");
      setCustomTarget("100");
      setReferenceMode("latest");
      setCreateError(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => {
          if (createOnly) {
            openCreateSheet();
            return;
          }
          setPickerOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={createOnly ? "새 프로젝트 만들기" : "프로젝트 선택"}
        style={({ pressed }) => [
          styles.headerButton,
          compact && styles.headerButtonCompact,
          createOnly && styles.createOnlyButton,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed
        ]}
      >
        {createOnly ? (
          <View style={styles.createOnlyRow}>
            <Feather name="plus" size={16} color="#F5F5F5" />
            <Text style={styles.createOnlyText}>새 프로젝트 만들기</Text>
          </View>
        ) : (
          <>
            <View style={[styles.headerMainRow, compact && styles.headerMainRowCompact]}>
              {!compact ? <Feather name="folder" size={16} color="#F5F5F5" /> : null}
              <Text
                numberOfLines={1}
                style={[styles.headerTitle, compact && styles.headerTitleCompact]}
              >
                {activeProject?.name ?? "프로젝트 선택"}
              </Text>
              <Feather name="chevron-down" size={compact ? 14 : 16} color="#A0A0A6" />
            </View>
            <Text
              numberOfLines={1}
              style={[styles.headerStatus, compact && styles.headerStatusCompact]}
            >
              {activeSummary
                ? `${activeSummary.photoCount} / ${activeSummary.targetPhotoCount} · ${formatDuration(activeSummary.durationSeconds)}초`
                : "첫 프로젝트를 만들어주세요"}
            </Text>
          </>
        )}
      </Pressable>

      <Modal
        transparent
        animationType="slide"
        visible={pickerOpen}
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
            onPress={() => undefined}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>프로젝트 선택</Text>
            <ScrollView style={styles.projectList} showsVerticalScrollIndicator={false}>
              {visibleProjects.map((project) => {
                const summary = getBodyProjectProgressSummary(photos, project);
                const selected = project.id === activeProject?.id;
                return (
                  <Pressable
                    key={project.id}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.projectRow,
                      pressed && styles.projectRowPressed
                    ]}
                    onPress={() => {
                      onSelectProject(project);
                      setPickerOpen(false);
                    }}
                  >
                    <View style={styles.projectTextWrap}>
                      <Text style={styles.projectName}>{project.name}</Text>
                      <Text style={styles.projectMeta}>
                        {summary.photoCount}장 · {formatDuration(summary.durationSeconds)}초
                      </Text>
                    </View>
                    {selected ? <Feather name="check" size={18} color="#F5F5F5" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable style={styles.actionRow} onPress={openCreateSheet}>
                <Text style={styles.actionText}>+ 새 프로젝트</Text>
              </Pressable>
              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  setPickerOpen(false);
                  onManageProjects?.();
                }}
              >
                <Text style={styles.actionTextSecondary}>프로젝트 관리</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={createOpen}
        onRequestClose={() => setCreateOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
            onPress={() => undefined}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>새 프로젝트</Text>

            <Text style={styles.label}>프로젝트 이름</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="새 프로젝트"
              placeholderTextColor="#68686E"
              style={styles.input}
              maxLength={40}
            />

            <Text style={styles.label}>목표 기록 수</Text>
            {maxProgressPhotos !== null ? (
              <Text style={styles.planLimitText}>
                현재 플랜 최대 {maxProgressPhotos}장
              </Text>
            ) : null}
            <View style={styles.choiceRow}>
              {(["100", "365", "custom"] as const).map((value) => {
                const presetTarget =
                  value === "100" ? 100 : value === "365" ? 365 : null;
                const locked =
                  presetTarget !== null &&
                  !isBodyFrameProjectTargetAllowed({
                    targetPhotoCount: presetTarget,
                    maxProgressPhotos
                  });

                return (
                  <Pressable
                    key={value}
                    disabled={locked}
                    style={[
                      styles.choice,
                      targetPreset === value && styles.choiceSelected,
                      locked && styles.disabled
                    ]}
                    onPress={() => {
                      setTargetPreset(value);
                      setCreateError(null);
                    }}
                  >
                    <Text style={styles.choiceText}>
                      {value === "custom"
                        ? "직접 입력"
                        : locked
                          ? `${value} · ${upgradePlanLabel ?? "상위 플랜"}`
                          : value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {targetPreset === "custom" ? (
              <TextInput
                value={customTarget}
                onChangeText={(value) => {
                  setCustomTarget(value);
                  setCreateError(null);
                }}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="100"
                placeholderTextColor="#68686E"
              />
            ) : null}
            {createError ? (
              <View style={styles.limitNotice}>
                <Text style={styles.limitNoticeText}>{createError}</Text>
                {upgradePlanLabel && onUpgrade ? (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.limitUpgradeButton}
                    onPress={() => {
                      closeAll();
                      onUpgrade();
                    }}
                  >
                    <Text style={styles.limitUpgradeButtonText}>
                      플랜 보기 · {upgradePlanLabel}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.label}>기준 사진</Text>
            <Pressable
              style={[
                styles.referenceChoice,
                referenceMode === "latest" && styles.referenceChoiceSelected
              ]}
              onPress={() => setReferenceMode("latest")}
            >
              <View>
                <Text style={styles.referenceTitle}>최근 사진</Text>
                <Text style={styles.referenceMeta}>바로 전 사진과 맞춥니다.</Text>
              </View>
              {referenceMode === "latest" ? (
                <Feather name="check" size={18} color="#F5F5F5" />
              ) : null}
            </Pressable>
            <Pressable
              style={[
                styles.referenceChoice,
                referenceMode === "first" && styles.referenceChoiceSelected
              ]}
              onPress={() => setReferenceMode("first")}
            >
              <View>
                <Text style={styles.referenceTitle}>첫 번째 사진</Text>
                <Text style={styles.referenceMeta}>첫 번째 사진과 계속 맞춥니다.</Text>
              </View>
              {referenceMode === "first" ? (
                <Feather name="check" size={18} color="#F5F5F5" />
              ) : null}
            </Pressable>

            <Pressable
              disabled={submitting}
              style={[styles.primaryButton, submitting && styles.disabled]}
              onPress={() => void submitProject()}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? "생성 중..." : "프로젝트 만들기"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: 54,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#2A2A2E",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "rgba(11,11,12,0.88)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center"
  },
  headerButtonCompact: {
    minHeight: bodyFrameDesign.minTouchSize,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  createOnlyButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    paddingHorizontal: 12,
    paddingVertical: 0
  },
  createOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  createOnlyText: {
    color: "#F5F5F5",
    fontSize: 13,
    fontWeight: "600"
  },
  headerMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headerMainRowCompact: {
    gap: 5
  },
  headerTitle: {
    flex: 1,
    color: "#F5F5F5",
    fontSize: 15,
    fontWeight: "600"
  },
  headerTitleCompact: {
    fontSize: 13
  },
  headerStatus: {
    marginTop: 3,
    color: "#A0A0A6",
    fontSize: 12
  },
  headerStatusCompact: {
    marginTop: 1,
    fontSize: 10
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)"
  },
  sheet: {
    maxHeight: "82%",
    backgroundColor: "#131315",
    borderTopLeftRadius: bodyFrameDesign.bottomSheetRadius,
    borderTopRightRadius: bodyFrameDesign.bottomSheetRadius,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#2A2A2E",
    paddingHorizontal: 16,
    paddingTop: 10
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3A3A3E",
    marginBottom: 14
  },
  sheetTitle: {
    color: "#F5F5F5",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 14
  },
  projectList: { maxHeight: 360 },
  projectRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center"
  },
  projectRowPressed: { opacity: 0.7 },
  projectTextWrap: { flex: 1 },
  projectName: { color: "#F5F5F5", fontSize: 15, fontWeight: "500" },
  projectMeta: { color: "#A0A0A6", fontSize: 12, marginTop: 4 },
  sheetActions: { marginTop: 8 },
  actionRow: { minHeight: bodyFrameDesign.primaryButtonHeight, justifyContent: "center" },
  actionText: { color: "#F5F5F5", fontSize: 15, fontWeight: "600" },
  actionTextSecondary: { color: "#A0A0A6", fontSize: 14 },
  label: { color: "#A0A0A6", fontSize: 12, marginTop: 12, marginBottom: 8 },
  planLimitText: {
    marginBottom: 8,
    color: "#68686E",
    fontSize: 12
  },
  input: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#2A2A2E",
    borderRadius: bodyFrameDesign.buttonRadius,
    color: "#F5F5F5",
    backgroundColor: "#0B0B0C",
    paddingHorizontal: 12
  },
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: {
    flex: 1,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#2A2A2E",
    borderRadius: 8
  },
  choiceSelected: { borderColor: "#F5F5F5" },
  choiceText: { color: "#F5F5F5", fontSize: bodyFrameTypography.caption },
  referenceChoice: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2E",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8
  },
  referenceChoiceSelected: { borderColor: "#F5F5F5" },
  referenceTitle: { color: "#F5F5F5", fontSize: bodyFrameTypography.rowTitle, fontWeight: "500" },
  referenceMeta: { color: "#A0A0A6", fontSize: 12, marginTop: 3 },
  limitNotice: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2A2A2E",
    borderRadius: 8,
    backgroundColor: "#0B0B0C"
  },
  limitNoticeText: {
    color: "#D7D7DB",
    fontSize: 12,
    lineHeight: 18
  },
  limitUpgradeButton: {
    minHeight: 44,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#F5F5F5",
    borderRadius: 8
  },
  limitUpgradeButtonText: {
    color: "#F5F5F5",
    fontSize: 13,
    fontWeight: "600"
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    marginTop: 14
  },
  primaryButtonText: { color: "#111111", fontSize: 15, fontWeight: "700" }
});
