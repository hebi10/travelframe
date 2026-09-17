import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import TripClipScreen from "@/features/trip-clip/TripClipScreen";
import { selectActiveBodyProject } from "@/lib/body-frame-camera-project";
import {
  getLastActiveProjectId,
  setLastActiveProjectId
} from "@/lib/body-project-preferences";
import { getBodyProjects } from "@/lib/body-project-library";
import type { BodyProject } from "@/types/body-project";

export default function BodyFrameVideoScreen() {
  const [activeProject, setActiveProject] = useState<BodyProject | null | undefined>(
    undefined
  );

  const loadActiveProject = useCallback(async () => {
    const [projects, lastActiveProjectId] = await Promise.all([
      getBodyProjects(),
      getLastActiveProjectId()
    ]);
    const selectedProject = selectActiveBodyProject(projects, lastActiveProjectId);

    setActiveProject(selectedProject);

    if (selectedProject && selectedProject.id !== lastActiveProjectId) {
      await setLastActiveProjectId(selectedProject.id);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadActiveProject();
    }, [loadActiveProject])
  );

  if (activeProject === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#F5F5F5" />
        <Text style={styles.detail}>프로젝트를 불러오는 중입니다.</Text>
      </View>
    );
  }

  if (!activeProject) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>변화 영상을 만들 프로젝트가 없습니다.</Text>
        <Text style={styles.detail}>
          촬영 화면에서 프로젝트를 만든 뒤 다시 확인해 주세요.
        </Text>
      </View>
    );
  }

  return <TripClipScreen bodyFrameProjectId={activeProject.id} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    backgroundColor: "#0B0B0C"
  },
  title: {
    color: "#F5F5F5",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center"
  },
  detail: {
    color: "#A0A0A6",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  }
});
