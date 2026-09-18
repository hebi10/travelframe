import { router, useFocusEffect } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { BodyFrameProjectSwitcher } from "@/features/camera/BodyFrameProjectSwitcher";
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
  getBodyFrameUpgradeLabel
} from "@/lib/body-frame-plan-limits";
import {
  getLastActiveProjectId,
  setLastActiveProjectId
} from "@/lib/body-project-preferences";
import { getBodyMeasurementSettings } from "@/lib/body-measurement-library";
import {
  createBodyProject,
  getBodyProjects
} from "@/lib/body-project-library";
import { getPhotos } from "@/lib/photo-library";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import type { BodyProject, ReferencePhotoMode } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

type CreateProjectInput = {
  name: string;
  targetPhotoCount: number;
  referenceMode: ReferencePhotoMode;
};

export default function BodyFrameCameraScreen() {
  const insets = useSafeAreaInsets();
  const { isLoggedIn, subscription } = useAuth();
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
  const lastHandledSaveAtRef = useRef(0);

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
      void reloadProjectState();
      return () => {
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
      projectPhotoCount: activeSummary?.photoCount ?? 0,
      maxProgressPhotos: planEntitlements.maxProgressPhotos,
      captureBlockedReason
    });
  }, [
    activeProject,
    activeSummary?.photoCount,
    automaticReferenceUri,
    captureBlockedReason,
    nextProjectSequence,
    planEntitlements.maxProgressPhotos
  ]);

  useEffect(() => {
    if (
      session.lastSavedAt <= 0 ||
      session.lastSavedAt === lastHandledSaveAtRef.current ||
      !session.lastSavedSequence
    ) {
      return;
    }

    lastHandledSaveAtRef.current = session.lastSavedAt;
    setSaveMessage(`${session.lastSavedSequence}번째 사진을 저장했습니다.`);
    setMeasurementPromptPhotoId(null);

    void (async () => {
      const projectId = session.projectId;
      if (!projectId) {
        await reloadProjectState();
        return;
      }

      const [storedPhotos, measurementSettings] = await Promise.all([
        getPhotos(),
        getBodyMeasurementSettings(projectId)
      ]);
      const savedPhoto =
        storedPhotos.find(
          (photo) =>
            photo.projectId === projectId &&
            photo.sequence === session.lastSavedSequence
        ) ?? null;

      if (
        measurementSettings.enabled &&
        measurementSettings.promptAfterCapture &&
        savedPhoto
      ) {
        setMeasurementPromptPhotoId(savedPhoto.id);
      }

      await reloadProjectState();
    })();

    const timeout = setTimeout(() => {
      setSaveMessage(null);
      setMeasurementPromptPhotoId(null);
    }, 4200);
    return () => clearTimeout(timeout);
  }, [
    reloadProjectState,
    session.lastSavedAt,
    session.lastSavedSequence,
    session.projectId
  ]);

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
      const project = await createBodyProject({
        name,
        targetPhotoCount,
        referenceMode
      });
      const storedPhotos = await getPhotos();
      const storedProjects = await getBodyProjects();
      setProjects(storedProjects);
      setPhotos(storedPhotos);
      setActiveProjectId(project.id);
      await setLastActiveProjectId(project.id);
    },
    []
  );

  const firstPhotoHint = captureBlockedReason
    ? captureBlockedReason
    : activeProject && activeSummary?.photoCount === 0
      ? "첫 사진을 찍어 기준을 만들어주세요."
      : activeProject
        ? `오늘 ${nextProjectSequence}번째 기록`
        : "프로젝트를 먼저 만들어주세요.";

  return (
    <View style={styles.screen}>
      <CameraScreen />

      <View
        pointerEvents="box-none"
        style={[
          styles.projectSwitcherWrap,
          { top: Math.max(insets.top + 64, 76) }
        ]}
      >
        <BodyFrameProjectSwitcher
          projects={projects}
          photos={photos}
          activeProject={activeProject}
          disabled={session.pendingSaveCount > 0}
          maxProgressPhotos={planEntitlements.maxProgressPhotos}
          upgradePlanLabel={upgradePlanLabel}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          onUpgrade={() => router.push("/account")}
          onManageProjects={() => router.push("/studio")}
        />
        <Text style={styles.captureHint}>{firstPhotoHint}</Text>
        {captureBlockedReason && upgradePlanLabel ? (
          <Pressable
            accessibilityRole="button"
            style={styles.planButton}
            onPress={() => router.push("/account")}
          >
            <Text style={styles.planButtonText}>플랜 보기 · {upgradePlanLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {saveMessage ? (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>{saveMessage}</Text>
          {measurementPromptPhotoId ? (
            <Pressable
              accessibilityRole="button"
              style={styles.snackbarAction}
              onPress={() =>
                router.push({
                  pathname: "/photo/[id]",
                  params: { id: measurementPromptPhotoId, measurement: "1" }
                })
              }
            >
              <Text style={styles.snackbarActionText}>수치 기록</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0B0C"
  },
  projectSwitcherWrap: {
    position: "absolute",
    left: bodyFrameDesign.horizontalPadding,
    right: bodyFrameDesign.horizontalPadding,
    zIndex: 40
  },
  captureHint: {
    alignSelf: "center",
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: bodyFrameDesign.buttonRadius,
    overflow: "hidden",
    color: "#D7D7DB",
    backgroundColor: "rgba(11,11,12,0.72)",
    fontSize: bodyFrameTypography.caption
  },
  planButton: {
    alignSelf: "center",
    minHeight: bodyFrameDesign.minTouchSize,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#F5F5F5",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "rgba(11,11,12,0.88)"
  },
  planButtonText: {
    color: "#F5F5F5",
    fontSize: 13,
    fontWeight: "600"
  },
  snackbar: {
    position: "absolute",
    left: bodyFrameDesign.horizontalPadding,
    right: bodyFrameDesign.horizontalPadding,
    bottom: 118,
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#2A2A2E",
    borderRadius: bodyFrameDesign.cardRadius,
    backgroundColor: "#1A1A1D",
    zIndex: 50
  },
  snackbarText: {
    flex: 1,
    color: "#F5F5F5",
    fontSize: 13,
    fontWeight: "500"
  },
  snackbarAction: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 8
  },
  snackbarActionText: {
    color: "#F5F5F5",
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  }
});
