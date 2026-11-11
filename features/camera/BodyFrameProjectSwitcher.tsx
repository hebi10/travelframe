import { AppText as Text, AppTextInput as TextInput } from "@/components/app-text";
import { BodyFrameSheetFooter, BodyFrameSheetHandle, BodyFrameSheetHeader } from "@/components/body-frame-sheet";
import {
  Feather } from "@expo/vector-icons";
import { useEffect,
  useMemo,
  useState } from "react";
import {
  Keyboard,
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

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

  const dismissCreateSheet = () => {
    if (!submitting) {
      setCreateOpen(false);
    }
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
    } catch (error) {
      setCreateError(
        error instanceof Error && error.message
          ? error.message
          : "프로젝트를 만들지 못했습니다. 다시 시도해 주세요."
      );
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
            <BodyFrameSheetHeader
              compactTypography={compact}
              title="프로젝트 선택"
              description="촬영할 프로젝트를 선택하세요."
              onClose={() => setPickerOpen(false)}
            />
            <View style={styles.pickerSummaryRow}>
              <Text style={[styles.pickerSectionTitle, { color: palette.text }]}>
                내 프로젝트
              </Text>
              <Text style={[styles.pickerSectionCount, { color: palette.muted }]}>
                {visibleProjects.length}개
              </Text>
            </View>
            <ScrollView
              style={styles.projectList}
              contentContainerStyle={styles.projectListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {visibleProjects.length === 0 ? (
                <View style={[styles.emptyProjectState, { backgroundColor: palette.background, borderColor: palette.line }]}>
                  <Feather name="folder" size={24} color={palette.muted} />
                  <Text style={[styles.emptyProjectTitle, { color: palette.text }]}>
                    진행 중인 프로젝트가 없습니다.
                  </Text>
                  <Text style={[styles.emptyProjectDescription, { color: palette.muted }]}>
                    새 프로젝트를 만들고 첫 사진부터 기록하세요.
                  </Text>
                </View>
              ) : (
                visibleProjects.map((project) => {
                  const summary = getBodyProjectProgressSummary(photos, project);
                  const selected = project.id === activeProject?.id;
                  return (
                    <Pressable
                      key={project.id}
                      disabled={disabled}
                      accessibilityRole="radio"
                      accessibilityLabel={`${project.name} 프로젝트`}
                      accessibilityHint={selected ? "현재 촬영 중인 프로젝트입니다." : "선택하면 이 프로젝트로 촬영합니다."}
                      accessibilityState={{ selected, disabled }}
                      style={({ pressed }) => [
                        styles.projectRow,
                        {
                          borderColor: selected ? palette.text : palette.line,
                          backgroundColor: selected ? palette.surfaceStrong : palette.surface
                        },
                        pressed && styles.projectRowPressed
                      ]}
                      onPress={() => {
                        onSelectProject(project);
                        setPickerOpen(false);
                      }}
                    >
                      <View style={styles.projectTextWrap}>
                        <Text numberOfLines={2} style={[styles.projectName, { color: palette.text }]}>
                          {project.name}
                        </Text>
                        <Text numberOfLines={2} style={[styles.projectMeta, { color: palette.muted }]}>
                          {summary.photoCount} / {summary.targetPhotoCount}장 · {formatDuration(summary.durationSeconds)}초
                        </Text>
                      </View>
                      {selected ? (
                        <View style={styles.selectedProjectMarker}>
                          <Text style={[styles.selectedProjectText, { color: palette.text }]}>촬영 중</Text>
                          <Feather name="check" size={18} color={palette.text} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="+ 새 프로젝트"
                style={[styles.pickerCreateAction, { backgroundColor: actionColor }]}
                onPress={openCreateSheet}
              >
                <Text numberOfLines={2} style={[styles.actionText, { color: actionTextColor }]}>+ 새 프로젝트</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.pickerManageAction, { borderColor: palette.line }]}
                onPress={() => {
                  setPickerOpen(false);
                  onManageProjects?.();
                }}
              >
                <Text numberOfLines={2} style={[styles.actionTextSecondary, { color: palette.text }]}>
                  프로젝트 관리
                </Text>
                <Feather name="chevron-right" size={18} color={palette.muted} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={createOpen}
        onRequestClose={dismissCreateSheet}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingRoot}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "android" ? insets.top : 0}
        >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="새 프로젝트 닫기"
            style={StyleSheet.absoluteFill}
            onPress={dismissCreateSheet}
          />
          <View
            style={[styles.sheet, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 16), backgroundColor: palette.surface, borderColor: palette.line }]}
            accessibilityViewIsModal
          >
            <BodyFrameSheetHandle />
            <BodyFrameSheetHeader
              compactTypography={compact}
              title="새 프로젝트"
              description="프로젝트별로 같은 구도의 변화를 기록하세요."
              onClose={dismissCreateSheet}
            />
            <ScrollView
              style={styles.createScroll}
              contentContainerStyle={styles.createScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
            <Text style={[styles.label, { color: palette.text }]}>프로젝트 이름</Text>
            <TextInput
              value={name}
              onChangeText={(value) => {
                setName(value);
                setCreateError(null);
              }}
              placeholder="새 프로젝트"
              placeholderTextColor={palette.faint}
              style={[styles.input, { backgroundColor: palette.background, color: palette.text, borderColor: palette.line }]}
              maxLength={40}
              accessibilityLabel="프로젝트 이름"
              editable={!submitting}
              returnKeyType="done"
            />

            <View style={styles.formSectionHeader}>
              <Text style={[styles.label, { color: palette.text }]}>목표 기록 수</Text>
              {maxProgressPhotos !== null ? (
                <Text style={[styles.planLimitText, { color: palette.muted }]}>
                  현재 플랜 최대 {maxProgressPhotos}장
                </Text>
              ) : null}
            </View>
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
                      { borderColor: palette.line, backgroundColor: palette.surface },
                      targetPreset === value && { borderColor: palette.text, backgroundColor: palette.surfaceStrong },
                      locked && styles.disabled
                    ]}
                    onPress={() => {
                      setTargetPreset(value);
                      setCreateError(null);
                    }}
                  >
                    <Text numberOfLines={2} style={[styles.choiceText, { color: palette.text }]}>
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
                style={[styles.input, styles.customTargetInput, { backgroundColor: palette.background, color: palette.text, borderColor: palette.line }]}
                placeholder="100"
                placeholderTextColor={palette.faint}
                editable={!submitting}
              />
            ) : null}
            {createError ? (
              <View
                style={[styles.limitNotice, { backgroundColor: palette.background, borderColor: palette.line }]}
                accessibilityLiveRegion="polite"
              >
                <Text style={[styles.limitNoticeText, { color: palette.text }]}>{createError}</Text>
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

            <View style={styles.referenceSectionHeader}>
              <Text style={[styles.label, { color: palette.text }]}>촬영 기준 사진 방식</Text>
              <Text style={[styles.referenceHint, { color: palette.muted }]}>
                두 번째 촬영부터 겹쳐 볼 사진을 선택합니다.
              </Text>
            </View>
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
            <View style={[styles.createFooter, keyboardVisible && styles.createFooterKeyboard]}>
              <BodyFrameSheetFooter
                compactTypography={compact}
                onCancel={dismissCreateSheet}
                onConfirm={() => void submitProject()}
                confirmLabel={submitting ? "생성 중..." : "프로젝트 만들기"}
                confirmFlex={1.6}
                disabled={submitting}
              />
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
    flexShrink: 0,
    paddingTop: 12,
    paddingBottom: 4
  },
  createFooterKeyboard: {
    paddingTop: 8,
    paddingBottom: 0
  },
  headerButton: {
    minHeight: 54,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#2A2A2E",
    borderRadius: 12,
    backgroundColor: "rgba(11,11,12,0.88)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center"
  },
  headerButtonCompact: {
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(11,11,12,0.8)"
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
    lineHeight: 18,
    includeFontPadding: false,
    fontWeight: "700"
  },
  headerMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headerMainRowCompact: {
    gap: 6,
    justifyContent: "center"
  },
  headerTitle: {
    flex: 1,
    color: "#F5F5F5",
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
    fontWeight: "700"
  },
  headerTitleCompact: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center"
  },
  headerStatus: {
    marginTop: 3,
    color: "#A0A0A6",
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false
  },
  headerStatusCompact: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center"
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
    lineHeight: 28,
    includeFontPadding: false,
    fontWeight: "700",
    marginBottom: 10
  },
  pickerSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 16,
    marginBottom: 6
  },
  pickerSectionTitle: {
    fontSize: bodyFrameTypography.rowTitle,
    lineHeight: 20,
    includeFontPadding: false,
    fontWeight: "700"
  },
  pickerSectionCount: { fontSize: bodyFrameTypography.caption, lineHeight: 18, includeFontPadding: false },
  projectList: { flexShrink: 1, minHeight: 0, maxHeight: 360 },
  projectListContent: { gap: 8, paddingVertical: 8 },
  projectRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: 12
  },
  projectRowPressed: { opacity: 0.7 },
  projectTextWrap: { flex: 1, minWidth: 0 },
  projectName: { fontSize: 15, fontWeight: "700", lineHeight: 21, includeFontPadding: false },
  projectMeta: { fontSize: 12, marginTop: 4, lineHeight: 18, includeFontPadding: false },
  selectedProjectMarker: { flexDirection: "row", alignItems: "center", gap: 5 },
  selectedProjectText: { fontSize: bodyFrameTypography.caption, lineHeight: 18, fontWeight: "700", includeFontPadding: false },
  emptyProjectState: {
    minHeight: 152,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: 12
  },
  emptyProjectTitle: {
    fontSize: bodyFrameTypography.rowTitle,
    lineHeight: 20,
    includeFontPadding: false,
    fontWeight: "700",
    textAlign: "center"
  },
  emptyProjectDescription: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    includeFontPadding: false,
    textAlign: "center"
  },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 12, paddingTop: 8 },
  pickerCreateAction: {
    flex: 1,
    minWidth: 0,
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12
  },
  pickerManageAction: {
    flex: 1,
    minWidth: 0,
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: 12
  },
  actionText: { fontSize: bodyFrameTypography.button, lineHeight: 20, fontWeight: "700", includeFontPadding: false, textAlign: "center" },
  actionTextSecondary: { fontSize: bodyFrameTypography.button, lineHeight: 20, fontWeight: "700", includeFontPadding: false, textAlign: "center" },
  label: { fontSize: bodyFrameTypography.rowTitle, lineHeight: 20, fontWeight: "700", includeFontPadding: false, marginTop: 10, marginBottom: 8 },
  formSectionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 8,
    marginBottom: 4
  },
  planLimitText: { fontSize: bodyFrameTypography.caption, lineHeight: 18, includeFontPadding: false },
  input: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#2A2A2E",
    borderRadius: 12,
    color: "#F5F5F5",
    backgroundColor: "#0B0B0C",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: bodyFrameTypography.body,
    lineHeight: 20,
    includeFontPadding: false
  },
  choiceRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  choice: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    paddingHorizontal: 5,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: 12
  },
  choiceText: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center"
  },
  customTargetInput: { marginTop: 8 },
  referenceSectionHeader: { marginTop: 14, marginBottom: 10 },
  referenceHint: { fontSize: bodyFrameTypography.caption, lineHeight: 18, includeFontPadding: false },
  referenceChoice: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  referenceText: { flex: 1, minWidth: 0 },
  referenceTitle: { fontSize: bodyFrameTypography.rowTitle, lineHeight: 20, fontWeight: "700", includeFontPadding: false },
  referenceMeta: { fontSize: bodyFrameTypography.caption, lineHeight: 18, includeFontPadding: false, marginTop: 4 },
  limitNotice: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2A2A2E",
    borderRadius: 12,
    backgroundColor: "#0B0B0C"
  },
  limitNoticeText: {
    color: "#D7D7DB",
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false
  },
  limitUpgradeButton: {
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#F5F5F5",
    borderRadius: 12
  },
  limitUpgradeButtonText: {
    color: "#F5F5F5",
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    fontWeight: "700"
  },
  primaryButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12
  },
  primaryButtonText: { fontSize: bodyFrameTypography.button, lineHeight: 20, fontWeight: "700", includeFontPadding: false }
});
