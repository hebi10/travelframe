import { openPlans } from "@/lib/plan-navigation";
import { AppText as Text } from "@/components/app-text";
import {
  router,
  useFocusEffect } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import { Alert,
  Pressable,
  StyleSheet,
  View
} from "react-native";

import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { BodyFrameProjectSwitcher } from "@/features/camera/BodyFrameProjectSwitcher";
import { BodyMeasurementEditorSheet } from "@/features/records/BodyMeasurementEditorSheet";
import { createCaptureMeasurementPromptQueue, type CaptureMeasurementPrompt } from "@/lib/capture-measurement-prompt";
import CameraScreen from "@/features/camera/CameraScreen";
import { useAuth } from "@/lib/auth-context";
import {
  getBodyProjectProgressSummary,
  getBodyProjectReferenceUri,
  getNextBodyProjectSequence,
  selectActiveBodyProject,
  selectBodyProjectReferencePhoto
} from "@/lib/body-frame-camera-project";
import {
  clearBodyFrameCameraSession,
  getBodyFrameCameraSessionSnapshot,
  setBodyFrameCameraSession,
  subscribeBodyFrameCameraSession
} from "@/lib/body-frame-camera-session";
import {
  getBodyFrameCaptureLimitState,
  getBodyFrameProjectCreationLimitState,
  getBodyFrameUpgradeLabel
} from "@/lib/body-frame-plan-limits";
import {
  getLastActiveProjectId,
  setLastActiveProjectId
} from "@/lib/body-project-preferences";
import { getBodyMeasurementSettings, getBodyMeasurementByPhotoId, initializeNewBodyProjectMeasurements } from "@/lib/body-measurement-library";
import { getBodyPoseAlignmentSettings } from "@/lib/body-pose-alignment";
import {
  createBodyProject,
  getBodyProjectById,
  getBodyProjects,
  updateBodyProject
} from "@/lib/body-project-library";
import { getPhotos } from "@/lib/photo-library";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { getSelectedCloudBackupProjectIds } from "@/lib/cloud-backup-project-slots";
import { enqueueProjectCloudSync } from "@/lib/project-cloud-sync-queue";
import { isProjectCloudSaveMode } from "@/lib/project-save-policy";
import type { BodyProject, ProjectSaveMode, ReferencePhotoMode } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

type CreateProjectInput = {
  name: string;
  targetPhotoCount: number;
  referenceMode: ReferencePhotoMode;
};

export default function BodyFrameCameraScreen() {
  const { isLoggedIn, subscription, user } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const upgradePlanLabel = getBodyFrameUpgradeLabel(planEntitlements.tier);
  const session = useSyncExternalStore(
    subscribeBodyFrameCameraSession,
    getBodyFrameCameraSessionSnapshot,
    getBodyFrameCameraSessionSnapshot
  );
  const [projects, setProjects] = useState<BodyProject[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [measurementPromptPhotoId, setMeasurementPromptPhotoId] =
    useState<string | null>(null);
  const [poseAlignmentEnabled, setPoseAlignmentEnabled] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(false);
  const [capturePrompts, setCapturePrompts] = useState<CaptureMeasurementPrompt[]>([]);
  const capturePromptQueueRef = useRef<ReturnType<typeof createCaptureMeasurementPromptQueue> | null>(null);
  if (!capturePromptQueueRef.current) {
    capturePromptQueueRef.current = createCaptureMeasurementPromptQueue({
      load: async (photo) => {
        const projectId = photo.projectId;
        if (!projectId) return null;
        const [measurementSettings, entry, project] = await Promise.all([
          getBodyMeasurementSettings(projectId),
          getBodyMeasurementByPhotoId(projectId, photo.id),
          getBodyProjectById(projectId)
        ]);
        if (!(measurementSettings.enabled && measurementSettings.promptAfterCapture)) return null;
        setMeasurementPromptPhotoId(photo.id);
        return {
          photo,
          settings: measurementSettings,
          projectName: project?.name ?? "프로젝트 기록",
          entry: entry?.source === "manual" ? entry : null
        };
      },
      onChange: setCapturePrompts
    });
  }

  const reloadProjectState = useCallback(async () => {
    const [storedProjects, storedPhotos, lastActiveProjectId] = await Promise.all([
      getBodyProjects(),
      getPhotos(),
      getLastActiveProjectId()
    ]);
    const selectedProject = selectActiveBodyProject(
      storedProjects,
      lastActiveProjectId
    );

    setProjects(storedProjects);
    setPhotos(storedPhotos);
    setActiveProjectId(selectedProject?.id ?? null);

    if (selectedProject && selectedProject.id !== lastActiveProjectId) {
      await setLastActiveProjectId(selectedProject.id);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      void reloadProjectState();
      return () => {
        setIsScreenFocused(false);
        clearBodyFrameCameraSession();
      };
    }, [reloadProjectState])
  );

  const activeProject = useMemo(
    () =>
      projects.find(
        (project) => project.id === activeProjectId && !project.archived
      ) ?? selectActiveBodyProject(projects, activeProjectId),
    [activeProjectId, projects]
  );

  useEffect(() => {
    let active = true;
    setPoseAlignmentEnabled(false);

    if (!activeProject) {
      return () => {
        active = false;
      };
    }

    void getBodyPoseAlignmentSettings(activeProject.id)
      .then((settings) => {
        if (active) {
          setPoseAlignmentEnabled(settings.enabled);
        }
      })
      .catch(() => {
        if (active) {
          setPoseAlignmentEnabled(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeProject?.id]);

  const nextProjectSequence = useMemo(
    () =>
      activeProject
        ? getNextBodyProjectSequence(photos, activeProject.id)
        : 1,
    [activeProject, photos]
  );

  const referencePhoto = useMemo(
    () =>
      activeProject
        ? selectBodyProjectReferencePhoto(photos, activeProject)
        : null,
    [activeProject, photos]
  );
  const automaticReferenceUri = getBodyProjectReferenceUri(referencePhoto);

  const activeSummary = useMemo(
    () =>
      activeProject
        ? getBodyProjectProgressSummary(photos, activeProject)
        : null,
    [activeProject, photos]
  );

  const captureLimitState = useMemo(
    () =>
      getBodyFrameCaptureLimitState({
        photoCount: activeSummary?.photoCount ?? 0,
        maxProgressPhotos: planEntitlements.maxProgressPhotos
      }),
    [activeSummary?.photoCount, planEntitlements.maxProgressPhotos]
  );

  const captureBlockedReason =
    activeProject && !captureLimitState.allowed && captureLimitState.limit
      ? `${planEntitlements.label} 플랜은 프로젝트당 ${captureLimitState.limit}장까지 기록할 수 있습니다.`
      : null;

  useEffect(() => {
    if (!activeProject) {
      clearBodyFrameCameraSession();
      return;
    }

    setBodyFrameCameraSession({
      projectId: activeProject.id,
      sequence: nextProjectSequence,
      automaticReferenceUri,
      poseAlignmentEnabled,
      projectPhotoCount: activeSummary?.photoCount ?? 0,
      maxProgressPhotos: planEntitlements.maxProgressPhotos,
      captureBlockedReason
    });
  }, [
    activeProject,
    activeSummary?.photoCount,
    automaticReferenceUri,
    poseAlignmentEnabled,
    captureBlockedReason,
    nextProjectSequence,
    planEntitlements.maxProgressPhotos
  ]);

  const handleCapturedPhotoSaved = useCallback((photo: PhotoItem) => {
    setSaveMessage(`${photo.sequence ?? 1}번째 사진을 저장했습니다.`);
    setMeasurementPromptPhotoId(null);
    void capturePromptQueueRef.current?.enqueue(photo).catch(() => {
      setSaveMessage("사진은 저장했습니다. 수치 정보는 사진 상세에서 입력할 수 있습니다.");
    });
    void reloadProjectState().catch(() => undefined);
  }, [reloadProjectState]);

  const dismissCapturePrompt = useCallback((photoId: string) => {
    capturePromptQueueRef.current?.dismiss(photoId);
  }, []);

  const activeCapturePrompt = capturePrompts[0] ?? null;

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setSaveMessage(null);
      setMeasurementPromptPhotoId(null);
    }, 4200);

    return () => clearTimeout(timeout);
  }, [saveMessage]);

  const handleSelectProject = useCallback(
    (project: BodyProject) => {
      if (session.pendingSaveCount > 0) {
        return;
      }

      setActiveProjectId(project.id);
      void setLastActiveProjectId(project.id);
    },
    [session.pendingSaveCount]
  );

  const handleCreateProject = useCallback(
    async ({
      name,
      targetPhotoCount,
      referenceMode
    }: CreateProjectInput) => {
      const activeProjectCount = projects.filter(
        (project) => !project.archived
      ).length;
      const projectLimitState = getBodyFrameProjectCreationLimitState({
        activeProjectCount,
        maxProjectCount: planEntitlements.maxProjectCount
      });
      if (!projectLimitState.allowed) {
        throw new Error(
          `현재 플랜에서는 프로젝트를 최대 ${projectLimitState.limit ?? activeProjectCount}개까지 만들 수 있습니다.`
        );
      }

      const project = await createBodyProject({
        name,
        targetPhotoCount,
        referenceMode
      });
      await initializeNewBodyProjectMeasurements(project.id).catch(() => {
        Alert.alert("수치 입력 설정", "프로젝트는 생성됐지만 촬영 후 수치 입력 설정을 저장하지 못했습니다. 프로젝트 설정에서 다시 활성화해 주세요.");
      });
      const storedPhotos = await getPhotos();
      const storedProjects = await getBodyProjects();
      setProjects(storedProjects);
      setPhotos(storedPhotos);
      setActiveProjectId(project.id);
      await setLastActiveProjectId(project.id);
    },
    [planEntitlements.maxProjectCount, projects]
  );

  const handleChangeReferenceMode = useCallback(async (projectId: string, referenceMode: ReferencePhotoMode) => {
    if (activeProject?.id !== projectId) throw new Error("선택한 프로젝트가 변경되었습니다. 다시 시도해주세요.");
    const updatedProject = await updateBodyProject(projectId, { referenceMode });
    if (!updatedProject) throw new Error("프로젝트를 찾을 수 없습니다.");
    setProjects((current) => current.map((project) => project.id === projectId ? updatedProject : project));
  }, [activeProject?.id]);

  const handleChangeProjectSaveMode = useCallback(async (projectId: string, mode: ProjectSaveMode) => {
    if (!activeProject || activeProject.id !== projectId ||
        session.pendingSaveCount > 0 ||
        getBodyFrameCameraSessionSnapshot().projectId !== projectId) {
      throw new Error("프로젝트가 변경되거나 사진 저장 중입니다. 다시 시도해 주세요.");
    }
    if (isProjectCloudSaveMode(mode)) {
      if (!user || !planEntitlements.canBackupToCloud) {
        openPlans("backup", "Pro");
        return;
      }
      const eligibleIds = await getSelectedCloudBackupProjectIds(
        user, planEntitlements.maxCloudBackupProjects
      );
      if (!eligibleIds.has(projectId)) {
        Alert.alert(
          "백업 프로젝트 선택 필요",
          "먼저 계정 화면에서 이 프로젝트를 클라우드 백업 프로젝트로 선택해 주세요.",
          [
            { text: "취소", style: "cancel" },
            { text: "계정으로 이동", onPress: () => router.push("/account") }
          ]
        );
        return;
      }
    }
    if (getBodyFrameCameraSessionSnapshot().projectId !== projectId) {
      throw new Error("촬영 프로젝트가 변경되었습니다.");
    }
    const updated = await updateBodyProject(projectId, { saveMode: mode });
    if (!updated) throw new Error("프로젝트를 찾지 못했습니다.");
    setProjects((current) => current.map((item) => item.id === projectId ? updated : item));
    if (isProjectCloudSaveMode(mode) && mode !== activeProject.saveMode) {
      await enqueueProjectCloudSync({ projectId, kind: "initial" }).catch(() => undefined);
    }
  }, [
    activeProject, planEntitlements.canBackupToCloud,
    planEntitlements.maxCloudBackupProjects, session.pendingSaveCount, user
  ]);

  const firstPhotoHint = captureBlockedReason
    ? captureBlockedReason
    : activeProject && activeSummary?.photoCount === 0
      ? "첫 사진을 찍어 기준을 만들어주세요."
      : activeProject
        ? `오늘 ${nextProjectSequence}번째 기록`
        : "프로젝트를 먼저 만들어주세요.";

  return (
    <View style={styles.screen}>
      <CameraScreen
        projectReferenceMode={activeProject?.referenceMode}
        onProjectReferenceModeChange={activeProject ? handleChangeReferenceMode : undefined}
        projectSaveMode={activeProject?.saveMode ?? null}
        onProjectSaveModeChange={activeProject ? handleChangeProjectSaveMode : undefined}
        onPhotoSaved={handleCapturedPhotoSaved}
        headerCenter={
          <BodyFrameProjectSwitcher
            compact
            projects={projects}
            photos={photos}
            activeProject={activeProject}
            disabled={session.pendingSaveCount > 0}
            maxProgressPhotos={planEntitlements.maxProgressPhotos}
            maxProjectCount={planEntitlements.maxProjectCount}
            upgradePlanLabel={upgradePlanLabel}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onUpgrade={() => openPlans("camera", upgradePlanLabel)}
            onManageProjects={() => router.push("/studio")}
          />
        }
        footerStatus={
          saveMessage ? (
            <View style={styles.captureStatusRow} accessibilityLiveRegion="polite">
              <Text style={styles.captureSavedText} numberOfLines={2}>
                {saveMessage}
              </Text>
              {measurementPromptPhotoId ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.captureStatusAction}
                  onPress={() =>
                    router.push({
                      pathname: "/photo/[id]",
                      params: { id: measurementPromptPhotoId, measurement: "1" }
                    })
                  }
                >
                  <Text style={styles.captureStatusActionText}>수치 기록</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.captureStatusRow}>
              <Text style={styles.captureStatusText} numberOfLines={2}>
                {firstPhotoHint}
              </Text>
              {captureBlockedReason && upgradePlanLabel ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.captureStatusAction}
                  onPress={() => openPlans("camera", upgradePlanLabel)}
                >
                  <Text style={styles.captureStatusActionText}>
                    플랜 보기 · {upgradePlanLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
      />
      {activeCapturePrompt ? (
        <BodyMeasurementEditorSheet
          key={activeCapturePrompt.photo.id}
          visible={isScreenFocused}
          projectId={activeCapturePrompt.photo.projectId ?? ""}
          photoId={activeCapturePrompt.photo.id}
          sequence={activeCapturePrompt.photo.sequence}
          recordedAt={activeCapturePrompt.photo.createdAt}
          settings={activeCapturePrompt.settings}
          entry={activeCapturePrompt.entry}
          capturePhoto={{
            uri: activeCapturePrompt.photo.previewUri ?? activeCapturePrompt.photo.uri,
            projectName: activeCapturePrompt.projectName,
            sequence: activeCapturePrompt.photo.sequence
          }}
          onClose={() => dismissCapturePrompt(activeCapturePrompt.photo.id)}
          onSaved={() => {
            setSaveMessage("사진과 수치 기록을 저장했습니다.");
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0B0C"
  },
  captureStatusRow: {
    width: "100%",
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 6
  },
  captureStatusText: {
    flexShrink: 1,
    color: "#D5D9DE",
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    textAlign: "center"
  },
  captureSavedText: {
    flexShrink: 1,
    color: "#F5F5F5",
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center"
  },
  captureStatusAction: {
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "rgba(255,255,255,0.42)",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "#1A1A1D"
  },
  captureStatusActionText: {
    color: "#F5F5F5",
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600"
  }
});
