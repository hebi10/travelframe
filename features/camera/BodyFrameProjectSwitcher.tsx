import { AppText as Text, AppTextInput as TextInput } from "@/components/app-text";
import { BodyFrameSheetHandle, BodyFrameSheetHeader } from "@/components/body-frame-sheet";
import {
  Feather } from "@expo/vector-icons";
import { useMemo,
  useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign, bodyFrameSheetDesign, bodyFrameTypography, getBodyFrameControlColors } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
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
  const { palette } = useAppAppearance();
  const { primaryBackground: actionColor, primaryText: actionTextColor } =
    getBodyFrameControlColors(palette);
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
        accessibilityState={{ disabled }}
        accessibilityHint={createOnly ? "프로젝트 생성 설정을 엽니다." : "현재 촬영할 프로젝트를 변경합니다."}
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
            <Text style={styles.createOnlyText}>새 프로젝트</Text>
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
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로젝트 선택 닫기"
            style={StyleSheet.absoluteFill}
            onPress={() => setPickerOpen(false)}
          />
          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: palette.surface, borderColor: palette.line }]}
            accessibilityViewIsModal
          >
            <BodyFrameSheetHandle />
            <BodyFrameSheetHeader title="프로젝트 선택" onClose={() => setPickerOpen(false)} />
            <ScrollView style={styles.projectList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {visibleProjects.map((project) => {
                const summary = getBodyProjectProgressSummary(photos, project);
                const selected = project.id === activeProject?.id;
                return (
                  <Pressable
                    key={project.id}
                    disabled={disabled}
                    accessibilityRole="radio"
                    accessibilityLabel={`${project.name} 프로젝트`}
                    accessibilityState={{ selected, disabled }}
                    style={({ pressed }) => [
                      styles.projectRow,
                      { backgroundColor: selected ? palette.surfaceStrong : palette.surface },
                      pressed && styles.projectRowPressed
                    ]}
                    onPress={() => {
                      onSelectProject(project);
                      setPickerOpen(false);
                    }}
                  >
                    <View style={styles.projectTextWrap}>
                      <Text style={[styles.projectName, { color: palette.text }]}>{project.name}</Text>
                      <Text style={[styles.projectMeta, { color: palette.muted }]}>
                        {summary.photoCount}장 · {formatDuration(summary.durationSeconds)}초
                      </Text>
                    </View>
                    {selected ? <Feather name="check" size={18} color={palette.text} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" style={styles.actionRow} onPress={openCreateSheet}>
                <Text style={[styles.actionText, { color: palette.text }]}>+ 새 프로젝트</Text>
              </Pressable>
              <Pressable accessibilityRole="button"
                style={styles.actionRow}
                onPress={() => {
                  setPickerOpen(false);
                  onManageProjects?.();
                }}
              >
                <Text style={[styles.actionTextSecondary, { color: palette.muted }]}>프로젝트 관리</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={createOpen}
        onRequestClose={() => setCreateOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingRoot}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="새 프로젝트 닫기"
            style={StyleSheet.absoluteFill}
            onPress={() => setCreateOpen(false)}
          />
          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: palette.surface, borderColor: palette.line }]}
            accessibilityViewIsModal
          >
            <BodyFrameSheetHandle />
            <BodyFrameSheetHeader title="새 프로젝트" onClose={() => setCreateOpen(false)} />
            <ScrollView
              style={styles.createScroll}
              contentContainerStyle={styles.createScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator
            >
            <Text style={[styles.label, { color: palette.muted }]}>프로젝트 이름</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="새 프로젝트"
              placeholderTextColor={palette.faint}
              style={[styles.input, { backgroundColor: palette.background, color: palette.text, borderColor: palette.line }]}
              maxLength={40}
              accessibilityLabel="프로젝트 이름"
            />

            <Text style={[styles.label, { color: palette.muted }]}>목표 기록 수</Text>
            {maxProgressPhotos !== null ? (
              <Text style={[styles.planLimitText, { color: palette.muted }]}>
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
                    accessibilityRole="radio"
                    accessibilityLabel={value === "custom" ? "목표 기록 수 직접 입력" : `목표 ${value}장`}
                    accessibilityState={{ selected: targetPreset === value, disabled: locked }}
                    style={[
                      styles.choice,
                      { borderColor: palette.line },
                      targetPreset === value && { borderColor: palette.text },
                      locked && styles.disabled
                    ]}
                    onPress={() => {
                      setTargetPreset(value);
                      setCreateError(null);
                    }}
                  >
                    <Text style={[styles.choiceText, { color: palette.text }]}>
                      {value === "custom"
                        ? "직접 입력"
                        : locked
                          ? `${value}장 · ${upgradePlanLabel ?? "상위 플랜"}`
                          : `${value}장`}
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
                accessibilityLabel="목표 기록 수 직접 입력"
                style={[styles.input, { backgroundColor: palette.background, color: palette.text, borderColor: palette.line }]}
                placeholder="100"
                placeholderTextColor={palette.faint}
              />
            ) : null}
            {createError ? (
              <View style={[styles.limitNotice, { backgroundColor: palette.background, borderColor: palette.line }]}>
                <Text style={[styles.limitNoticeText, { color: palette.muted }]}>{createError}</Text>
                {upgradePlanLabel && onUpgrade ? (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.limitUpgradeButton, { borderColor: palette.text }]}
                    onPress={() => {
                      closeAll();
                      onUpgrade();
                    }}
                  >
                    <Text style={[styles.limitUpgradeButtonText, { color: palette.text }]}>
                      플랜 보기 · {upgradePlanLabel}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Text style={[styles.label, { color: palette.text }]}>촬영 기준 사진 방식</Text>
            <Text style={[styles.referenceHint, { color: palette.muted }]}>
              두 번째 촬영부터 겹쳐 볼 사진을 선택합니다.
            </Text>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="최근 사진을 기준으로 촬영"
              accessibilityHint="바로 전 촬영 사진을 겹쳐 자세를 맞춥니다."
              accessibilityState={{ selected: referenceMode === "latest" }}
              style={[
                styles.referenceChoice,
                {
                  borderColor: referenceMode === "latest" ? actionColor : palette.line,
                  backgroundColor: referenceMode === "latest" ? palette.surfaceStrong : palette.surface
                }
              ]}
              onPress={() => setReferenceMode("latest")}
            >
              <View style={styles.referenceText}>
                <Text style={[styles.referenceTitle, { color: palette.text }]}>최근 사진</Text>
                <Text style={[styles.referenceMeta, { color: palette.muted }]}>직전 촬영 사진을 반투명하게 표시</Text>
              </View>
              {referenceMode === "latest" ? (
                <Feather name="check" size={18} color={actionColor} />
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="첫 번째 사진을 기준으로 촬영"
              accessibilityHint="첫 번째 촬영 사진을 이후 촬영마다 겹쳐 자세를 맞춥니다."
              accessibilityState={{ selected: referenceMode === "first" }}
              style={[
                styles.referenceChoice,
                {
                  borderColor: referenceMode === "first" ? actionColor : palette.line,
                  backgroundColor: referenceMode === "first" ? palette.surfaceStrong : palette.surface
                }
              ]}
              onPress={() => setReferenceMode("first")}
            >
              <View style={styles.referenceText}>
                <Text style={[styles.referenceTitle, { color: palette.text }]}>첫 번째 사진</Text>
                <Text style={[styles.referenceMeta, { color: palette.muted }]}>첫 촬영 사진을 기준으로 계속 표시</Text>
              </View>
              {referenceMode === "first" ? (
                <Feather name="check" size={18} color={actionColor} />
              ) : null}
            </Pressable>


            </ScrollView>
            <View style={styles.createFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting }}
              disabled={submitting}
              style={[styles.primaryButton, { backgroundColor: actionColor }, submitting && styles.disabled]}
              onPress={() => void submitProject()}
            >
              <Text style={[styles.primaryButtonText, { color: actionTextColor }]}>
                {submitting ? "생성 중..." : "프로젝트 만들기"}
              </Text>
            </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingRoot: {
    flex: 1
  },
  createScroll: { flexShrink: 1, minHeight: 0 },
  createScrollContent: { paddingBottom: 16 },
  createFooter: {
    paddingTop: 8,
    paddingBottom: 4
  },
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
    flex: 1,
    minHeight: bodyFrameDesign.primaryButtonHeight,
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
    fontSize: bodyFrameTypography.caption
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: bodyFrameSheetDesign.backdropColor
  },
  sheet: {
    width: "100%",
    maxWidth: bodyFrameDesign.contentMaxWidth,
    alignSelf: "center",
    maxHeight: bodyFrameSheetDesign.maxHeight,
    backgroundColor: "#131315",
    borderTopLeftRadius: bodyFrameDesign.bottomSheetRadius,
    borderTopRightRadius: bodyFrameDesign.bottomSheetRadius,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#2A2A2E",
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingTop: 10
  },
  sheetTitle: {
    color: "#F5F5F5",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 10
  },
  projectList: { flexShrink: 1, minHeight: 0, maxHeight: 360 },
  projectRow: {
    minHeight: 64,
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
  label: { color: "#A0A0A6", fontSize: 12, marginTop: 8, marginBottom: 6 },
  planLimitText: {
    marginBottom: 8,
    color: "#A0A0A6",
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
  choiceText: { color: "#F5F5F5", fontSize: bodyFrameTypography.caption, textAlign: "center" },
  referenceHint: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    marginBottom: 6
  },
  referenceChoice: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2E",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6
  },
  referenceChoiceSelected: { borderColor: "#F5F5F5" },
  referenceText: { flex: 1 },
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
    marginTop: 0
  },
  primaryButtonText: { color: "#111111", fontSize: 15, fontWeight: "700" }
});
