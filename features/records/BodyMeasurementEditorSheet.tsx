import { useEffect, useMemo, useState } from "react";
import {
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
  deleteBodyMeasurement,
  saveBodyMeasurement
} from "@/lib/body-measurement-library";
import {
  bodyMeasurementInputRanges,
  parseMeasurementInput
} from "@/lib/body-measurement-normalization";
import { useAppAppearance } from "@/lib/app-appearance";
import {
  bodyMeasurementMetricMeta,
  type BodyMeasurementEntry,
  type BodyMeasurementMetric,
  type BodyMeasurementSettings
} from "@/types/body-measurement";

type Drafts = Record<BodyMeasurementMetric, string>;

const emptyDrafts: Drafts = {
  weight: "",
  bodyFat: "",
  skeletalMuscle: "",
  waist: ""
};

const getEntryDrafts = (entry?: BodyMeasurementEntry | null): Drafts => ({
  weight: entry?.weightKg !== undefined ? String(entry.weightKg) : "",
  bodyFat:
    entry?.bodyFatPercent !== undefined ? String(entry.bodyFatPercent) : "",
  skeletalMuscle:
    entry?.skeletalMuscleKg !== undefined
      ? String(entry.skeletalMuscleKg)
      : "",
  waist: entry?.waistCm !== undefined ? String(entry.waistCm) : ""
});

const parseDraft = (metric: BodyMeasurementMetric, value: string) => {
  if (metric === "weight") {
    return parseMeasurementInput(value, bodyMeasurementInputRanges.weightKg);
  }
  if (metric === "bodyFat") {
    return parseMeasurementInput(
      value,
      bodyMeasurementInputRanges.bodyFatPercent
    );
  }
  if (metric === "skeletalMuscle") {
    return parseMeasurementInput(
      value,
      bodyMeasurementInputRanges.skeletalMuscleKg
    );
  }
  return parseMeasurementInput(value, bodyMeasurementInputRanges.waistCm);
};

export function BodyMeasurementEditorSheet({
  visible,
  projectId,
  photoId,
  sequence,
  recordedAt,
  settings,
  entry,
  onClose,
  onSaved,
  onDeleted
}: {
  visible: boolean;
  projectId: string;
  photoId?: string;
  sequence?: number;
  recordedAt: string;
  settings: BodyMeasurementSettings;
  entry?: BodyMeasurementEntry | null;
  onClose: () => void;
  onSaved: (entry: BodyMeasurementEntry) => void;
  onDeleted?: () => void;
}) {
  const { palette } = useAppAppearance();
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const activeMetrics = useMemo(
    () =>
      (Object.entries(settings.fields) as [BodyMeasurementMetric, boolean][])
        .filter(([, enabled]) => enabled)
        .map(([metric]) => metric),
    [settings.fields]
  );

  useEffect(() => {
    if (!visible) return;
    setDrafts(getEntryDrafts(entry));
    setNote(entry?.note ?? "");
  }, [entry, visible]);

  const updateDraft = (metric: BodyMeasurementMetric, value: string) => {
    setDrafts((current) => ({ ...current, [metric]: value }));
  };

  const submit = async () => {
    if (saving) return;

    const parsed = Object.fromEntries(
      activeMetrics.map((metric) => [metric, parseDraft(metric, drafts[metric])])
    ) as Partial<Record<BodyMeasurementMetric, number | null | undefined>>;

    const invalidMetric = activeMetrics.find((metric) => parsed[metric] === null);
    if (invalidMetric) {
      Alert.alert(
        "입력 값을 확인해 주세요.",
        `${bodyMeasurementMetricMeta[invalidMetric].label} 값이 허용 범위를 벗어났습니다.`
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await saveBodyMeasurement({
        id: entry?.id,
        projectId,
        photoId,
        sequence,
        recordedAt,
        weightKg: parsed.weight,
        bodyFatPercent: parsed.bodyFat,
        skeletalMuscleKg: parsed.skeletalMuscle,
        waistCm: parsed.waist,
        note
      });
      onSaved(saved);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!entry || saving) return;

    Alert.alert("수치 기록을 삭제할까요?", "사진은 삭제되지 않습니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await deleteBodyMeasurement(entry.id);
              onDeleted?.();
              onClose();
            } finally {
              setSaving(false);
            }
          })();
        }
      }
    ]);
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.line,
              paddingBottom: Math.max(insets.bottom, 16)
            }
          ]}
          onPress={() => undefined}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: palette.text }]}>
                {entry ? "수치 기록 수정" : "수치 기록"}
              </Text>
              <Text style={[styles.detail, { color: palette.muted }]}>
                입력한 값은 현재 기기에만 저장됩니다.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              style={[styles.closeButton, { borderColor: palette.line }]}
              onPress={onClose}
            >
              <Text style={[styles.closeText, { color: palette.text }]}>닫기</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {activeMetrics.map((metric) => {
              const meta = bodyMeasurementMetricMeta[metric];
              return (
                <View key={metric} style={styles.field}>
                  <Text style={[styles.label, { color: palette.muted }]}>
                    {meta.label}
                  </Text>
                  <View
                    style={[
                      styles.inputRow,
                      {
                        borderColor: palette.line,
                        backgroundColor: palette.background
                      }
                    ]}
                  >
                    <TextInput
                      value={drafts[metric]}
                      onChangeText={(value) => updateDraft(metric, value)}
                      keyboardType="decimal-pad"
                      placeholder="입력 안 함"
                      placeholderTextColor={palette.faint}
                      style={[styles.input, { color: palette.text }]}
                    />
                    <Text style={[styles.unit, { color: palette.muted }]}>
                      {meta.unit}
                    </Text>
                  </View>
                </View>
              );
            })}

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.muted }]}>메모</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={500}
                placeholder="선택 입력"
                placeholderTextColor={palette.faint}
                style={[
                  styles.noteInput,
                  {
                    color: palette.text,
                    borderColor: palette.line,
                    backgroundColor: palette.background
                  }
                ]}
              />
            </View>

            <Pressable
              disabled={saving}
              accessibilityRole="button"
              style={[
                styles.primaryButton,
                {
                  backgroundColor: palette.text,
                  opacity: saving ? 0.5 : 1
                }
              ]}
              onPress={() => void submit()}
            >
              <Text style={[styles.primaryButtonText, { color: palette.inverse }]}>
                {saving ? "저장 중" : "저장"}
              </Text>
            </Pressable>

            {entry ? (
              <Pressable
                disabled={saving}
                accessibilityRole="button"
                style={[styles.deleteButton, { borderColor: palette.line }]}
                onPress={confirmDelete}
              >
                <Text style={[styles.deleteText, { color: palette.muted }]}>
                  수치 기록 삭제
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)"
  },
  sheet: {
    width: "100%",
    maxHeight: "86%",
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingTop: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderTopLeftRadius: bodyFrameDesign.bottomSheetRadius,
    borderTopRightRadius: bodyFrameDesign.bottomSheetRadius
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginBottom: 14,
    borderRadius: 2,
    backgroundColor: "#3A3A3E"
  },
  header: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12
  },
  headerCopy: {
    flex: 1,
    gap: 4
  },
  title: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  detail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  closeButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  closeText: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  content: {
    gap: 14,
    paddingBottom: 8
  },
  field: {
    gap: 7
  },
  label: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  inputRow: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  input: {
    flex: 1,
    minHeight: bodyFrameDesign.primaryButtonHeight,
    paddingHorizontal: 12,
    fontSize: bodyFrameTypography.body
  },
  unit: {
    minWidth: 40,
    paddingRight: 12,
    fontSize: bodyFrameTypography.caption,
    textAlign: "right"
  },
  noteInput: {
    minHeight: 84,
    padding: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius,
    fontSize: bodyFrameTypography.body,
    textAlignVertical: "top"
  },
  primaryButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: bodyFrameDesign.buttonRadius
  },
  primaryButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  },
  deleteButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  deleteText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  }
});
