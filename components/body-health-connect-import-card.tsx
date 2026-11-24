import { AppText as Text } from "@/components/app-text";
import Constants from "expo-constants";
import {
  useEffect,
  useMemo,
  useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View
} from "react-native";

import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import {
  getBodyHealthConnectAvailability,
  getBodyHealthConnectPermissionState,
  openBodyHealthConnectSettings,
  readBodyHealthConnectMeasurements,
  requestBodyHealthConnectReadPermissions,
  type BodyHealthConnectAvailability,
  type BodyHealthConnectCandidate,
  type BodyHealthConnectMetric
} from "@/lib/body-health-connect";
import {
  deleteBodyMeasurement,
  getBodyMeasurements,
  saveBodyMeasurement
} from "@/lib/body-measurement-library";
import { getPhotos } from "@/lib/photo-library";
import { findHealthConnectPhoto, getHealthConnectSourceMemberIds, groupBodyHealthConnectMeasurements, resolveHealthConnectMeasurementMatch } from "@/lib/body-health-connect-import";
import { useAppAppearance } from "@/lib/app-appearance";
import {
  bodyMeasurementMetricMeta,
  type BodyMeasurementSettings
} from "@/types/body-measurement";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const getSupportedMetrics = (
  settings: BodyMeasurementSettings
): BodyHealthConnectMetric[] => {
  const metrics: BodyHealthConnectMetric[] = [];
  if (settings.fields.weight) metrics.push("weight");
  if (settings.fields.bodyFat) metrics.push("bodyFat");
  return metrics;
};

const availabilityCopy: Record<BodyHealthConnectAvailability, string> = {
  available: "사용 가능",
  update_required: "업데이트 필요",
  unavailable: "사용할 수 없음",
  unsupported_platform: "Android에서만 지원"
};

export function BodyHealthConnectImportCard({
  projectId,
  settings,
  onImported
}: {
  projectId: string;
  settings: BodyMeasurementSettings;
  onImported: () => void;
}) {
  const { palette } = useAppAppearance();
  const supportedMetrics = useMemo(
    () => getSupportedMetrics(settings),
    [settings]
  );
  const [availability, setAvailability] =
    useState<BodyHealthConnectAvailability>("unavailable");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [candidates, setCandidates] = useState<BodyHealthConnectCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const groups = useMemo(() => groupBodyHealthConnectMeasurements(candidates), [candidates]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadState = async () => {
      if (supportedMetrics.length === 0) {
        if (active) {
          setAvailability("available");
          setPermissionGranted(false);
          setCandidates([]);
        }
        return;
      }

      try {
        const nextAvailability = await getBodyHealthConnectAvailability();
        if (!active) return;
        setAvailability(nextAvailability);

        if (nextAvailability !== "available") {
          setPermissionGranted(false);
          return;
        }

        const granted = await getBodyHealthConnectPermissionState(
          supportedMetrics
        );
        if (active) setPermissionGranted(granted);
      } catch {
        if (active) {
          setAvailability("unavailable");
          setPermissionGranted(false);
        }
      }
    };

    void loadState();
    return () => {
      active = false;
    };
  }, [supportedMetrics]);

  if (supportedMetrics.length === 0) {
    return null;
  }

  const requestAccess = async () => {
    if (loading) return;
    setLoading(true);
    setMessage(null);

    try {
      const granted = await requestBodyHealthConnectReadPermissions(
        supportedMetrics
      );
      setPermissionGranted(granted);
      if (!granted) {
        setMessage(
          "권한이 허용되지 않았습니다. Health Connect에서 권한을 다시 확인할 수 있습니다."
        );
      }
    } catch {
      setMessage("Health Connect 권한을 요청하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async () => {
    if (loading) return;
    setLoading(true);
    setMessage(null);

    try {
      const granted = permissionGranted
        ? true
        : await getBodyHealthConnectPermissionState(supportedMetrics);
      setPermissionGranted(granted);

      if (!granted) {
        setMessage("먼저 Health Connect 읽기 권한을 허용해 주세요.");
        return;
      }

      const next = await readBodyHealthConnectMeasurements({
        metrics: supportedMetrics,
        days: 30
      });
      setCandidates(next);
      setMessage(
        next.length > 0
          ? `최근 30일 기록 ${groupBodyHealthConnectMeasurements(next).length}건을 확인했습니다.`
          : "최근 30일에 가져올 수 있는 몸무게 또는 체지방 기록이 없습니다."
      );
    } catch {
      setMessage("Health Connect 기록을 읽지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const importCandidates = async () => {
    if (loading || candidates.length === 0) return;

    setLoading(true);
    setMessage(null);

    try {
      let imported = 0;
      let skipped = 0;

      const [savedEntries, allPhotos] = await Promise.all([getBodyMeasurements(projectId), getPhotos()]);
      const occupiedPhotoIds = new Set(savedEntries.flatMap((entry) => entry.photoId ? [entry.photoId] : []));
      const projectPhotos = allPhotos.filter((photo) => photo.projectId === projectId);
      const matchedEntryIds = new Set<string>();

      for (const group of groupBodyHealthConnectMeasurements(candidates, savedEntries)) {
        const { existing, legacy } = resolveHealthConnectMeasurementMatch(group, savedEntries, matchedEntryIds);
        if (existing) matchedEntryIds.add(existing.id);
        const photo = existing?.photoId ? undefined :
          findHealthConnectPhoto(group.recordedAt, projectPhotos, occupiedPhotoIds);
        const manualFields = existing?.manualFields ?? [];
        const sourceMemberIds = getHealthConnectSourceMemberIds(existing, group);
        const aliasesChanged = sourceMemberIds.length !== (existing?.sourceMemberIds?.length ?? 0);
        const legacyDuplicates = [...new Set(legacy)].filter((entry) =>
          entry.id !== existing?.id && !entry.photoId && !entry.sourceMemberIds?.length && !entry.manualRecordedAt && !entry.note &&
          entry.skeletalMuscleKg === undefined && entry.waistCm === undefined &&
          (entry.weightKg === undefined || entry.weightKg === group.weightKg) &&
          (entry.bodyFatPercent === undefined || entry.bodyFatPercent === group.bodyFatPercent));
        if (existing && !photo && !aliasesChanged && !legacyDuplicates.length &&
            (group.weightKg === undefined || existing.weightKg !== undefined || manualFields.includes("weightKg")) &&
            (group.bodyFatPercent === undefined || existing.bodyFatPercent !== undefined || manualFields.includes("bodyFatPercent"))) {
          skipped += 1;
          continue;
        }

        await saveBodyMeasurement({
          id: existing?.id,
          projectId,
          photoId: existing?.photoId ?? photo?.id,
          sequence: existing?.sequence ?? photo?.sequence,
          recordedAt: existing?.recordedAt ?? group.recordedAt,
          weightKg: manualFields.includes("weightKg") ? existing?.weightKg : existing?.weightKg ?? group.weightKg,
          bodyFatPercent: manualFields.includes("bodyFatPercent") ? existing?.bodyFatPercent : existing?.bodyFatPercent ?? group.bodyFatPercent,
          skeletalMuscleKg: existing?.skeletalMuscleKg,
          waistCm: existing?.waistCm,
          note: existing?.note,
          source: "health_connect",
          sourceRecordId: existing?.sourceRecordId ?? group.sourceRecordId,
          sourceMemberIds,
          sourceAppPackage: group.sourceAppPackage,
          manualFields: existing?.manualFields,
          manualRecordedAt: existing?.manualRecordedAt
        });
        for (const duplicate of legacyDuplicates) {
          await deleteBodyMeasurement(duplicate.id, { projectDeletion: true });
          matchedEntryIds.add(duplicate.id);
        }
        if (photo) occupiedPhotoIds.add(photo.id);
        imported += 1;
      }

      setCandidates([]);
      setMessage(
        imported > 0
          ? `Health Connect 기록 ${imported}개를 추가했습니다.${
              skipped > 0 ? ` 중복 ${skipped}개는 건너뛰었습니다.` : ""
            }`
          : "이미 가져온 기록입니다."
      );
      if (imported > 0) onImported();
    } catch {
      setMessage("Health Connect 기록을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = () => {
    if (candidates.length === 0) return;

    Alert.alert(
      "Health Connect 기록을 가져올까요?",
      "선택한 프로젝트의 로컬 수치 기록에 추가됩니다. 같은 날의 사진에 연결될 수 있으며 Firebase에는 자동으로 업로드되지 않습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "가져오기",
          onPress: () => void importCandidates()
        }
      ]
    );
  };

  const privacyUrl =
    typeof Constants.expoConfig?.extra?.privacyPolicyUrl === "string"
      ? Constants.expoConfig.extra.privacyPolicyUrl
      : null;

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
          <Text style={[styles.title, { color: palette.text }]}>
            Health Connect
          </Text>
          <Text style={[styles.detail, { color: palette.muted }]}>
            몸무게와 체지방률을 사용자가 원할 때만 읽어옵니다.
          </Text>
        </View>
        <Text style={[styles.status, { color: palette.muted }]}>
          {availabilityCopy[availability]}
        </Text>
      </View>

      <Text style={[styles.policyText, { color: palette.muted }]}>
        최근 30일 기록을 한 번에 가져올 수 있습니다. 가져온 수치는 이 기기에 보관합니다. 골격근량과 허리둘레는
        Health Connect에서 자동으로 가져오지 않습니다.
      </Text>

      {availability === "available" ? (
        <View style={styles.actions}>
          {!permissionGranted ? (
            <Pressable
              disabled={loading}
              accessibilityRole="button"
              style={[styles.primaryButton, { backgroundColor: palette.text }]}
              onPress={() => void requestAccess()}
            >
              <Text style={[styles.primaryButtonText, { color: palette.inverse }]}>
                {loading ? "확인 중" : "Health Connect 연결"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={loading}
              accessibilityRole="button"
              style={[styles.secondaryButton, { borderColor: palette.line }]}
              onPress={() => void loadCandidates()}
            >
              <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
                {loading ? "불러오는 중" : "최근 기록 확인"}
              </Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            style={styles.linkButton}
            onPress={openBodyHealthConnectSettings}
          >
            <Text style={[styles.linkText, { color: palette.muted }]}>
              Health Connect 권한 관리
            </Text>
          </Pressable>
        </View>
      ) : null}

      {availability === "update_required" ? (
        <Text style={[styles.notice, { color: palette.muted }]}>
          기기의 Health Connect를 업데이트한 뒤 다시 시도해 주세요.
        </Text>
      ) : null}

      {candidates.length > 0 ? (
        <View style={styles.preview}>
          {candidates.slice(0, 6).map((candidate) => (
            <View key={candidate.sourceRecordId} style={styles.previewRow}>
              <View style={styles.previewCopy}>
                <Text style={[styles.previewLabel, { color: palette.text }]}>
                  {bodyMeasurementMetricMeta[candidate.metric].label}
                </Text>
                <Text style={[styles.previewDate, { color: palette.muted }]}>
                  {formatDate(candidate.recordedAt)}
                </Text>
              </View>
              <Text style={[styles.previewValue, { color: palette.text }]}>
                {candidate.value}
                {bodyMeasurementMetricMeta[candidate.metric].unit}
              </Text>
            </View>
          ))}

          {candidates.length > 6 ? (
            <Text style={[styles.previewDate, { color: palette.muted }]}>
              미리보기 6개 · 가져올 수치 기록 {groups.length}건
            </Text>
          ) : null}
          <Pressable
            disabled={loading}
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: palette.text }]}
            onPress={confirmImport}
          >
            <Text style={[styles.primaryButtonText, { color: palette.inverse }]}>
              가져오기
            </Text>
          </Pressable>
        </View>
      ) : null}

      {message ? (
        <Text style={[styles.notice, { color: palette.muted }]}>{message}</Text>
      ) : null}

      {privacyUrl ? (
        <Pressable
          accessibilityRole="link"
          style={styles.linkButton}
          onPress={() => void Linking.openURL(privacyUrl)}
        >
          <Text style={[styles.linkText, { color: palette.muted }]}>
            개인정보처리방침
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
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
  title: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  detail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  status: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  policyText: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18
  },
  actions: {
    gap: 8
  },
  primaryButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  primaryButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  },
  secondaryButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  secondaryButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  linkButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center"
  },
  linkText: {
    fontSize: bodyFrameTypography.caption,
    textAlign: "center",
    textDecorationLine: "underline"
  },
  preview: {
    gap: 8
  },
  previewRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  previewCopy: {
    flex: 1,
    gap: 3
  },
  previewLabel: {
    fontSize: bodyFrameTypography.body,
    fontWeight: "600"
  },
  previewDate: {
    fontSize: bodyFrameTypography.caption
  },
  previewValue: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  notice: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18
  }
});
