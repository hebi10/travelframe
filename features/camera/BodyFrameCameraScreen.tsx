import { router, useFocusEffect } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BodyFrameProjectSwitcher } from "@/features/camera/BodyFrameProjectSwitcher";
import CameraScreen from "@/features/camera/CameraScreen";
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
  getLastActiveProjectId,
  setLastActiveProjectId
} from "@/lib/body-project-preferences";
import {
  createBodyProject,
  getBodyProjects
} from "@/lib/body-project-library";
import { getPhotos } from "@/lib/photo-library";
import type { BodyProject, ReferencePhotoMode } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

type CreateProjectInput = {
  name: string;
  targetPhotoCount: number;
  referenceMode: ReferencePhotoMode;
};

export default function BodyFrameCameraScreen() {
  const insets = useSafeAreaInsets();
  const session = useSyncExternalStore(
    subscribeBodyFrameCameraSession,
    getBodyFrameCameraSessionSnapshot,
    getBodyFrameCameraSessionSnapshot
  );
  const [projects, setProjects] = useState<BodyProject[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
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

  useEffect(() => {
    if (!activeProject) {
      clearBodyFrameCameraSession();
      return;
    }

    setBodyFrameCameraSession({
      projectId: activeProject.id,
      sequence: nextProjectSequence,
      automaticReferenceUri
    });
  }, [activeProject, automaticReferenceUri, nextProjectSequence]);

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
    void reloadProjectState();

    const timeout = setTimeout(() => {
      setSaveMessage(null);
    }, 2200);
    return () => clearTimeout(timeout);
  }, [reloadProjectState, session.lastSavedAt, session.lastSavedSequence]);

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

  const firstPhotoHint =
    activeProject && activeSummary?.photoCount === 0
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
          { top: Math.max(insets.top + 74, 84) }
        ]}
      >
        <BodyFrameProjectSwitcher
          projects={projects}
          photos={photos}
          activeProject={activeProject}
          disabled={session.pendingSaveCount > 0}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          onManageProjects={() => router.push("/studio")}
        />
        <Text style={styles.captureHint}>{firstPhotoHint}</Text>
      </View>

      {saveMessage ? (
        <View pointerEvents="none" style={styles.snackbar}>
          <Text style={styles.snackbarText}>{saveMessage}</Text>
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
    left: 16,
    right: 16,
    zIndex: 40
  },
  captureHint: {
    alignSelf: "center",
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
    color: "#D7D7DB",
    backgroundColor: "rgba(11,11,12,0.72)",
    fontSize: 12
  },
  snackbar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 118,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#2A2A2E",
    borderRadius: 8,
    backgroundColor: "#1A1A1D",
    zIndex: 50
  },
  snackbarText: {
    color: "#F5F5F5",
    fontSize: 13,
    fontWeight: "500"
  }
});
