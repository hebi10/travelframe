import { AppText as Text, AppTextInput as TextInput } from "@/components/app-text";
import {
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign, bodyFrameSheetDesign, bodyFrameTypography } from "@/constants/app-theme";
import { Image } from "@/components/private-media-image";
import { BodyFrameSheetFooter, BodyFrameSheetHandle, BodyFrameSheetHeader } from "@/components/body-frame-sheet";
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

const formatRecordedDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, partValue])
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const parseRecordedDate = (value: string, fallback: string) => {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const validationDate = new Date(Date.UTC(year, month - 1, day));

  if (
    validationDate.getUTCFullYear() !== year ||
    validationDate.getUTCMonth() !== month - 1 ||
    validationDate.getUTCDate() !== day
  ) {
    return null;
  }

  if (trimmed === formatRecordedDate(fallback)) {
    return fallback;
  }

  return new Date(`${trimmed}T12:00:00+09:00`).toISOString();
};

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
  requiredMetrics = [],
  allowRecordedAtEdit = false,
  capturePhoto,
  onClose,
  onSavePhotoDate,
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
  requiredMetrics?: BodyMeasurementMetric[];
  allowRecordedAtEdit?: boolean;
  capturePhoto?: { uri: string; projectName: string; sequence?: number };
  onClose: () => void;
  onSavePhotoDate?: (recordedAt: string) => Promise<void>;
  onSaved: (entry: BodyMeasurementEntry) => void;
  onDeleted?: () => void;
}) {
  const { palette } = useAppAppearance();
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts);
  const [recordedDateDraft, setRecordedDateDraft] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const requestClose = () => {
    if (!savingRef.current) onClose();
  };

  const activeMetrics = useMemo(() => {
    const configuredMetrics = (
      Object.entries(settings.fields) as [BodyMeasurementMetric, boolean][]
    )
      .filter(([, enabled]) => enabled)
      .map(([metric]) => metric);

    return Array.from(
      new Set<BodyMeasurementMetric>([...requiredMetrics, ...configuredMetrics])
    );
  }, [requiredMetrics, settings.fields]);

  useEffect(() => {
    if (!visible) return;
    setDrafts(getEntryDrafts(entry));
    setRecordedDateDraft(formatRecordedDate(onSavePhotoDate ? recordedAt : entry?.recordedAt ?? recordedAt));
    setNote(entry?.note ?? "");
    setSaveError(null);
  }, [entry, onSavePhotoDate, photoId, projectId, recordedAt, sequence, visible]);

  const updateDraft = (metric: BodyMeasurementMetric, value: string) => {
    setDrafts((current) => ({ ...current, [metric]: value }));
  };

  const submit = async () => {
    if (savingRef.current) return;
    setSaveError(null);

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

    const nextRecordedAt = allowRecordedAtEdit
      ? parseRecordedDate(recordedDateDraft, onSavePhotoDate ? recordedAt : entry?.recordedAt ?? recordedAt)
      : recordedAt;
    if (!nextRecordedAt) {
      Alert.alert(
        "날짜를 확인해 주세요.",
        "날짜는 YYYY-MM-DD 형식으로 입력해 주세요."
      );
      return;
    }

    const dateChanged = nextRecordedAt !== recordedAt;
    const hasMeasurement = entry || activeMetrics.some((metric) => parsed[metric] !== undefined) || note.trim();
    if (!hasMeasurement && !(onSavePhotoDate && dateChanged)) {
      requestClose();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (hasMeasurement) {
        const saved = await saveBodyMeasurement({
          id: entry?.id,
          projectId,
          photoId,
          sequence,
          recordedAt: entry?.source === "health_connect" && onSavePhotoDate ? entry.recordedAt : nextRecordedAt,
          weightKg: activeMetrics.includes("weight") ? parsed.weight ?? undefined : entry?.weightKg,
          bodyFatPercent: activeMetrics.includes("bodyFat") ? parsed.bodyFat ?? undefined : entry?.bodyFatPercent,
          skeletalMuscleKg: activeMetrics.includes("skeletalMuscle") ? parsed.skeletalMuscle ?? undefined : entry?.skeletalMuscleKg,
          waistCm: activeMetrics.includes("waist") ? parsed.waist ?? undefined : entry?.waistCm,
          note,
          source: entry?.source ?? "manual",
          sourceRecordId: entry?.sourceRecordId,
          sourceAppPackage: entry?.sourceAppPackage
        });
        onSaved(saved);
      }
      if (onSavePhotoDate && dateChanged) await onSavePhotoDate(nextRecordedAt);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "수치 기록을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!entry || saving) return;

    Alert.alert("수치 기록을 삭제할까요?", "이 수치 기록과 연결된 클라우드 백업이 삭제됩니다. 사진은 유지됩니다.", [
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
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel={capturePhoto ? "나중에 입력" : "수치 기록 닫기"} style={StyleSheet.absoluteFill} onPress={requestClose} />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.line,
              paddingBottom: Math.max(insets.bottom, 16)
            }
          ]}
        >
          <BodyFrameSheetHandle />
          <BodyFrameSheetHeader
            title={capturePhoto
              ? "촬영 기록 입력"
              : allowRecordedAtEdit
                ? entry ? "기록 정보 수정" : "기록 정보"
                : entry ? "수치 기록 수정" : "수치 기록"}
            description={capturePhoto
              ? "사진은 이미 저장되었습니다. 원하는 항목만 입력하거나 나중에 입력할 수 있습니다."
              : "직접 입력한 수치는 프로젝트 백업 설정에 따라 클라우드에도 저장됩니다."}
            closeLabel={capturePhoto ? "나중에 입력" : "닫기"}
            onClose={requestClose}
          />

          <ScrollView
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.content}
          >
            {capturePhoto ? (
              <View style={[styles.captureContext, { borderColor: palette.line, backgroundColor: palette.background }]}>
                <Image
                  source={{ uri: capturePhoto.uri }}
                  style={styles.captureThumbnail}
                  contentFit="contain"
                  accessibilityLabel="방금 저장한 사진"
                />
                <View style={styles.captureContextCopy}>
                  <Text numberOfLines={2} style={[styles.label, { color: palette.text }]}>
                    {capturePhoto.projectName}
                  </Text>
                  <Text style={[styles.detail, { color: palette.muted }]}>
                    {capturePhoto.sequence ? `${capturePhoto.sequence}번째 기록 · ` : ""}{formatRecordedDate(recordedAt)}
                  </Text>
                </View>
              </View>
            ) : null}
            {allowRecordedAtEdit ? (
              <View style={styles.field}>
                <Text style={[styles.label, { color: palette.muted }]}>날짜</Text>
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
                    accessibilityLabel="기록 날짜"
                    value={recordedDateDraft}
                    onChangeText={setRecordedDateDraft}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.faint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={10}
                    style={[styles.input, { color: palette.text }]}
                  />
                </View>
              </View>
            ) : null}

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
                      accessibilityLabel={`${meta.label} 수치 입력`}
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
                accessibilityLabel="수치 기록 메모"
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

          </ScrollView>
          <View style={styles.actionFooter}>
            {saveError ? (
              <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: palette.text }]}>
                {saveError}
              </Text>
            ) : null}
            <BodyFrameSheetFooter
              onCancel={requestClose}
              onConfirm={() => void submit()}
              cancelLabel={capturePhoto ? "나중에 입력" : "취소"}
              confirmLabel={saving ? "저장 중" : capturePhoto ? "정보 저장" : "저장"}
              disabled={saving}
            />
            {entry ? (
              <Pressable
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                style={[styles.deleteButton, { borderColor: palette.line }]}
                onPress={confirmDelete}
              >
                <Text style={[styles.deleteText, { color: palette.muted }]}>
                  {allowRecordedAtEdit ? "기록 정보 삭제" : "수치 기록 삭제"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingRoot: {
    flex: 1
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: bodyFrameSheetDesign.backdropColor
  },
  sheet: {
    width: "100%",
    gap: 10,
    maxWidth: bodyFrameDesign.contentMaxWidth,
    maxHeight: bodyFrameSheetDesign.maxHeight,
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingTop: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderTopLeftRadius: bodyFrameDesign.bottomSheetRadius,
    borderTopRightRadius: bodyFrameDesign.bottomSheetRadius
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
    paddingBottom: 12
  },
  contentScroll: {
    flexShrink: 1,
    minHeight: 0
  },
  actionFooter: {
    gap: 8,
    paddingTop: 10
  },
  captureContext: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    padding: 10
  },
  captureThumbnail: {
    width: 64,
    height: 80
  },
  captureContextCopy: {
    flex: 1,
    gap: 4
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
