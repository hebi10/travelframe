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

import { getBodyProjectProgressSummary } from "@/lib/body-frame-camera-project";
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
  onSelectProject: (project: BodyProject) => void;
  onCreateProject: (input: CreateProjectInput) => Promise<void> | void;
  onManageProjects?: () => void;
};

const formatDuration = (seconds: number) =>
  Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);

export function BodyFrameProjectSwitcher({
  projects,
  photos,
  activeProject,
  disabled = false,
  onSelectProject,
  onCreateProject,
  onManageProjects
}: BodyFrameProjectSwitcherProps) {
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("새 프로젝트");
  const [targetPreset, setTargetPreset] = useState<"100" | "365" | "custom">("100");
  const [customTarget, setCustomTarget] = useState("100");
  const [referenceMode, setReferenceMode] = useState<ReferencePhotoMode>("latest");
  const [submitting, setSubmitting] = useState(false);

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

  const closeAll = () => {
    setPickerOpen(false);
    setCreateOpen(false);
  };

  const submitProject = async () => {
    if (submitting) {
      return;
    }

    const parsedCustom = Number(customTarget);
    const targetPhotoCount =
      targetPreset === "365"
        ? 365
        : targetPreset === "custom"
          ? Math.max(1, Math.floor(Number.isFinite(parsedCustom) ? parsedCustom : 100))
          : 100;

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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="프로젝트 선택"
        style={({ pressed }) => [
          styles.headerButton,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed
        ]}
      >
        <View style={styles.headerMainRow}>
          <Feather name="folder" size={16} color="#F5F5F5" />
          <Text numberOfLines={1} style={styles.headerTitle}>
            {activeProject?.name ?? "프로젝트 선택"}
          </Text>
          <Feather name="chevron-down" size={16} color="#A0A0A6" />
        </View>
        <Text style={styles.headerStatus}>
          {activeSummary
            ? `${activeSummary.photoCount} / ${activeSummary.targetPhotoCount} · ${formatDuration(activeSummary.durationSeconds)}초`
            : "첫 프로젝트를 만들어주세요"}
        </Text>
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
              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  setPickerOpen(false);
                  setCreateOpen(true);
                }}
              >
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
            <View style={styles.choiceRow}>
              {(["100", "365", "custom"] as const).map((value) => (
                <Pressable
                  key={value}
                  style={[
                    styles.choice,
                    targetPreset === value && styles.choiceSelected
                  ]}
                  onPress={() => setTargetPreset(value)}
                >
                  <Text style={styles.choiceText}>
                    {value === "custom" ? "직접 입력" : value}
                  </Text>
                </Pressable>
              ))}
            </View>
            {targetPreset === "custom" ? (
              <TextInput
                value={customTarget}
                onChangeText={setCustomTarget}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="100"
                placeholderTextColor="#68686E"
              />
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
    borderWidth: 1,
    borderColor: "#2A2A2E",
    borderRadius: 8,
    backgroundColor: "rgba(11,11,12,0.88)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center"
  },
  headerMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headerTitle: {
    flex: 1,
    color: "#F5F5F5",
    fontSize: 15,
    fontWeight: "600"
  },
  headerStatus: {
    marginTop: 3,
    color: "#A0A0A6",
    fontSize: 12
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
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
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
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2A2A2E"
  },
  projectRowPressed: { opacity: 0.7 },
  projectTextWrap: { flex: 1 },
  projectName: { color: "#F5F5F5", fontSize: 15, fontWeight: "500" },
  projectMeta: { color: "#A0A0A6", fontSize: 12, marginTop: 4 },
  sheetActions: { marginTop: 8 },
  actionRow: { minHeight: 48, justifyContent: "center" },
  actionText: { color: "#F5F5F5", fontSize: 15, fontWeight: "600" },
  actionTextSecondary: { color: "#A0A0A6", fontSize: 14 },
  label: { color: "#A0A0A6", fontSize: 12, marginTop: 12, marginBottom: 8 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#2A2A2E",
    borderRadius: 8,
    color: "#F5F5F5",
    backgroundColor: "#0B0B0C",
    paddingHorizontal: 12
  },
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A2A2E",
    borderRadius: 8
  },
  choiceSelected: { borderColor: "#F5F5F5" },
  choiceText: { color: "#F5F5F5", fontSize: 13 },
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
  referenceTitle: { color: "#F5F5F5", fontSize: 14, fontWeight: "500" },
  referenceMeta: { color: "#A0A0A6", fontSize: 12, marginTop: 3 },
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
