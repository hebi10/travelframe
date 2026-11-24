import { StyleSheet, Pressable, Text, View } from "react-native";

import type { ProjectCloudBackupStatus } from "@/lib/project-cloud-backup-status";

type Props = {
  statuses: ProjectCloudBackupStatus[];
  loading: boolean;
  error: string | null;
  disabled: boolean;
  colors: { text: string; muted: string; line: string; surface: string };
  formatBytes: (bytes: number) => string;
  onRefresh: () => void;
  onRetry: (projectId: string) => void;
  onRestore: (projectId: string) => void;
};

const slotLabel: Record<ProjectCloudBackupStatus["slotStatus"], string> = {
  active: "백업 대상",
  paused: "새 백업 중지",
  over_limit: "플랜 슬롯 초과",
  replacing: "백업 대상 변경 중",
  unselected: "백업 슬롯 미선택"
};

export function ProjectCloudStatusCards({
  statuses, loading, error, disabled, colors, formatBytes,
  onRefresh, onRetry, onRestore
}: Props) {
  return (
    <View style={styles.content}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text }]}>프로젝트별 클라우드 현황</Text>
        <Pressable
          accessibilityRole="button"
          disabled={disabled || loading}
          onPress={onRefresh}
          style={[styles.button, { borderColor: colors.line }]}
        >
          <Text style={[styles.label, { color: colors.text }]}>새로고침</Text>
        </Pressable>
      </View>
      <Text style={[styles.detail, { color: colors.muted }]}>
        클라우드에 실제 저장된 사진·영상 수와 대기열입니다. 사용량은 확인 가능한 사진·영상 파일 기준이며 전체 사용량과 다를 수 있습니다.
      </Text>
      {loading ? (
        <Text style={[styles.detail, { color: colors.muted }]}>백업 상태를 확인하는 중입니다.</Text>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: colors.text }]}>
          {error}
        </Text>
      ) : null}
      {!loading && !error && statuses.length === 0 ? (
        <Text style={[styles.detail, { color: colors.muted }]}>
          확인할 프로젝트가 없습니다.
        </Text>
      ) : null}
      {statuses.map((item) => (
        <View key={item.projectId} style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, styles.projectName, { color: colors.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[styles.detail, { color: colors.muted }]}>
              {slotLabel[item.slotStatus]}{item.slotNumber ? ` · ${item.slotNumber}번` : ""}
            </Text>
          </View>
          <Text style={[styles.detail, { color: colors.muted }]}>
            사진 {item.cloudPhotos}/{item.localPhotos}장 · 영상 {item.cloudVideos}개 · 수치 기록 {item.cloudMeasurements}개
          </Text>
          <Text style={[styles.detail, { color: colors.muted }]}>
            확인된 보관 용량 {formatBytes(item.cloudBytes)} · 대기 {item.waitingItems}건
          </Text>
          <Text style={[styles.detail, { color: colors.muted }]}>
            마지막 파일 백업: {item.lastBackedUpAt
              ? new Date(item.lastBackedUpAt).toLocaleString("ko-KR")
              : "기록 없음"}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={disabled || item.slotStatus !== "active"}
              style={[styles.button, { borderColor: colors.line, opacity: disabled || item.slotStatus !== "active" ? 0.5 : 1 }]}
              onPress={() => onRetry(item.projectId)}
            >
              <Text style={[styles.label, { color: colors.text }]}>다시 동기화</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={disabled || item.cloudPhotos + item.cloudVideos + item.cloudMeasurements === 0}
              style={[styles.button, { borderColor: colors.line, opacity: disabled || item.cloudPhotos + item.cloudVideos + item.cloudMeasurements === 0 ? 0.5 : 1 }]}
              onPress={() => onRestore(item.projectId)}
            >
              <Text style={[styles.label, { color: colors.text }]}>프로젝트 복원</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 14, fontWeight: "700" },
  projectName: { flex: 1 },
  detail: { fontSize: 12, lineHeight: 19 },
  card: { borderWidth: 1, padding: 12, gap: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  button: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  label: { fontSize: 12, fontWeight: "600" }
});
