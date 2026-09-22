import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { User } from "firebase/auth";

import { SectionBlock } from "@/components/section-block";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import {
  getCloudBackupProjectSlots,
  replaceCloudBackupProject,
  selectCloudBackupProject,
  type CloudBackupProjectSlot
} from "@/lib/cloud-backup-project-slots";
import { getBodyProjects } from "@/lib/body-project-library";
import { getPhotos } from "@/lib/photo-library";
import type { BodyProject } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

export function CloudBackupProjectSlotsSection({
  user,
  maxSlots,
  maxPhotosPerProject
}: {
  user: User | null;
  maxSlots: number;
  maxPhotosPerProject: number;
}) {
  const { palette } = useAppAppearance();
  const [projects, setProjects] = useState<BodyProject[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [slots, setSlots] = useState<CloudBackupProjectSlot[]>([]);
  const [replacementSlotId, setReplacementSlotId] = useState<string | null>(null);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user || maxSlots <= 0) {
      setSlots([]);
      return;
    }

    const [storedProjects, storedPhotos, storedSlots] = await Promise.all([
      getBodyProjects(),
      getPhotos(),
      getCloudBackupProjectSlots(user)
    ]);
    setProjects(storedProjects.filter((project) => !project.archived));
    setPhotos(storedPhotos);
    setSlots(storedSlots);
  }, [maxSlots, user]);

  useFocusEffect(
    useCallback(() => {
      void reload().catch(() => {
        setMessage("클라우드 백업 프로젝트 정보를 불러오지 못했습니다.");
      });
    }, [reload])
  );

  const selectedProjectIds = useMemo(
    () => new Set(slots.map((slot) => slot.projectId)),
    [slots]
  );
  const availableProjects = useMemo(
    () => projects.filter((project) => !selectedProjectIds.has(project.id)),
    [projects, selectedProjectIds]
  );
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const photoCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    photos.forEach((photo) => {
      if (!photo.projectId) return;
      counts.set(photo.projectId, (counts.get(photo.projectId) ?? 0) + 1);
    });
    return counts;
  }, [photos]);

  if (!user || maxSlots <= 0) {
    return null;
  }

  const selectProject = async (project: BodyProject) => {
    if (busyProjectId) return;
    setBusyProjectId(project.id);
    setMessage(null);
    try {
      await selectCloudBackupProject({ user, projectId: project.id });
      await reload();
      setMessage(
        `"${project.name}" 프로젝트를 클라우드 백업 프로젝트로 선택했습니다.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "클라우드 백업 프로젝트를 선택하지 못했습니다."
      );
    } finally {
      setBusyProjectId(null);
    }
  };

  const confirmReplaceProject = (
    slot: CloudBackupProjectSlot,
    project: BodyProject
  ) => {
    const currentName =
      projectById.get(slot.projectId)?.name ?? "현재 백업 프로젝트";

    Alert.alert(
      "백업 프로젝트를 변경할까요?",
      `"${currentName}"의 클라우드 백업 사진과 연결된 프로젝트 영상이 모두 삭제됩니다. 기기에 저장된 원본은 삭제되지 않습니다. "${project.name}" 프로젝트는 처음부터 다시 업로드해야 합니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "기존 백업 삭제 후 변경",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyProjectId(project.id);
              setMessage(null);
              try {
                await replaceCloudBackupProject({
                  user,
                  slotId: slot.id,
                  projectId: project.id
                });
                setReplacementSlotId(null);
                await reload();
                setMessage(
                  `"${project.name}" 프로젝트로 백업 슬롯을 변경했습니다. 새 프로젝트는 처음부터 다시 백업됩니다.`
                );
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "백업 프로젝트를 변경하지 못했습니다."
                );
              } finally {
                setBusyProjectId(null);
              }
            })();
          }
        }
      ]
    );
  };

  const replacementSlot = replacementSlotId
    ? slots.find((slot) => slot.id === replacementSlotId) ?? null
    : null;
  const canAddSlot = slots.filter((slot) => slot.slotNumber <= maxSlots).length < maxSlots;

  return (
    <SectionBlock title="클라우드 프로젝트 백업">
      <View
        style={[
          styles.notice,
          {
            borderColor: palette.line,
            backgroundColor: palette.surface
          }
        ]}
      >
        <Text style={[styles.noticeTitle, { color: palette.text }]}>
          {Math.min(slots.length, maxSlots)} / {maxSlots}개 프로젝트 선택
        </Text>
        <Text style={[styles.detail, { color: palette.muted }]}>
          선택한 프로젝트만 클라우드에 백업되며 프로젝트당 사진 최대{" "}
          {maxPhotosPerProject}장을 저장할 수 있습니다.
        </Text>
        <Text style={[styles.warning, { color: palette.text }]}>
          백업 프로젝트는 선택 후 바로 수정할 수 없습니다. 변경하려면 기존
          클라우드 백업을 모두 삭제한 뒤 새 프로젝트를 처음부터 다시
          업로드해야 합니다. 로컬 원본은 삭제되지 않습니다.
        </Text>
      </View>

      <View style={styles.list}>
        {slots.map((slot) => {
          const project = projectById.get(slot.projectId);
          const lockedByPlan = slot.slotNumber > maxSlots;
          return (
            <View
              key={slot.id}
              style={[styles.row, { borderColor: palette.line }]}
            >
              <View style={styles.rowCopy}>
                <Text style={[styles.title, { color: palette.text }]}>
                  슬롯 {slot.slotNumber} · {project?.name ?? "로컬에 없는 프로젝트"}
                </Text>
                <Text style={[styles.detail, { color: palette.muted }]}>
                  {photoCountByProject.get(slot.projectId) ?? 0} /{" "}
                  {maxPhotosPerProject}장 ·{" "}
                  {lockedByPlan ? "현재 플랜 한도 초과" : "백업 프로젝트 고정됨"}
                </Text>
              </View>
              {!lockedByPlan ? (
                <Pressable
                  accessibilityRole="button"
                  style={[styles.smallButton, { borderColor: palette.line }]}
                  onPress={() =>
                    setReplacementSlotId((current) =>
                      current === slot.id ? null : slot.id
                    )
                  }
                >
                  <Text style={[styles.buttonText, { color: palette.text }]}>
                    {replacementSlotId === slot.id ? "변경 취소" : "삭제 후 변경"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {replacementSlot ? (
        <Text style={[styles.modeText, { color: palette.text }]}>
          새 프로젝트를 선택하면 기존 슬롯의 클라우드 데이터 삭제 확인창이
          표시됩니다.
        </Text>
      ) : canAddSlot ? (
        <Text style={[styles.modeText, { color: palette.muted }]}>
          아래에서 클라우드에 백업할 프로젝트를 선택하세요.
        </Text>
      ) : null}

      {(replacementSlot || canAddSlot) && availableProjects.length > 0 ? (
        <View style={styles.list}>
          {availableProjects.map((project) => (
            <View
              key={project.id}
              style={[styles.row, { borderColor: palette.line }]}
            >
              <View style={styles.rowCopy}>
                <Text style={[styles.title, { color: palette.text }]}>
                  {project.name}
                </Text>
                <Text style={[styles.detail, { color: palette.muted }]}>
                  로컬 사진 {photoCountByProject.get(project.id) ?? 0}장
                </Text>
              </View>
              <Pressable
                disabled={Boolean(busyProjectId)}
                accessibilityRole="button"
                style={[
                  styles.smallButton,
                  { borderColor: palette.line },
                  busyProjectId && styles.disabled
                ]}
                onPress={() =>
                  replacementSlot
                    ? confirmReplaceProject(replacementSlot, project)
                    : void selectProject(project)
                }
              >
                <Text style={[styles.buttonText, { color: palette.text }]}>
                  {busyProjectId === project.id
                    ? "처리 중"
                    : replacementSlot
                      ? "이 프로젝트로 변경"
                      : "백업 선택"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {message ? (
        <Text style={[styles.detail, { color: palette.muted }]}>{message}</Text>
      ) : null}
    </SectionBlock>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: 6,
    borderWidth: bodyFrameDesign.borderWidth,
    padding: 12
  },
  noticeTitle: {
    fontSize: bodyFrameTypography.body,
    fontWeight: "700"
  },
  title: {
    fontSize: bodyFrameTypography.body,
    fontWeight: "600"
  },
  detail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18
  },
  warning: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    fontWeight: "600"
  },
  modeText: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18
  },
  list: {
    gap: 8
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: bodyFrameDesign.borderWidth,
    paddingVertical: 8
  },
  rowCopy: {
    flex: 1,
    gap: 3
  },
  smallButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    paddingHorizontal: 10
  },
  buttonText: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  },
  disabled: {
    opacity: 0.45
  }
});
