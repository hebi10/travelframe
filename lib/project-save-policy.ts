import type { CameraSaveScope } from "@/lib/app-settings";
import type { BodyProject, ProjectSaveMode } from "@/types/body-project";

export type ProjectSaveTargets = {
  app: true;
  device: boolean;
  cloud: boolean;
};

export const PROJECT_SAVE_MODE_OPTIONS: readonly {
  value: ProjectSaveMode;
  label: string;
  detail: string;
}[] = [
  {
    value: "cloud",
    label: "클라우드",
    detail: "앱 보관함과 클라우드에 저장합니다. 기기 앨범에는 별도 저장하지 않습니다."
  },
  {
    value: "local_cloud",
    label: "로컬 + 클라우드",
    detail: "앱 보관함, 기기 앨범, 클라우드에 모두 저장합니다."
  },
  {
    value: "local_only",
    label: "로컬에만",
    detail: "앱 보관함과 기기 앨범에 저장하며 클라우드로 전송하지 않습니다."
  }
];

export const isProjectSaveMode = (value: unknown): value is ProjectSaveMode =>
  value === "cloud" || value === "local_cloud" || value === "local_only";

export const isProjectCloudSaveMode = (mode: ProjectSaveMode) =>
  mode === "cloud" || mode === "local_cloud";

export const getProjectSaveTargets = ({
  projectMode,
  legacyScope = "app_device",
  cloudAllowed = true
}: {
  projectMode?: ProjectSaveMode | null;
  legacyScope?: CameraSaveScope;
  cloudAllowed?: boolean;
}): ProjectSaveTargets => {
  if (projectMode && isProjectSaveMode(projectMode)) {
    return {
      app: true,
      device: projectMode !== "cloud",
      cloud: isProjectCloudSaveMode(projectMode) && cloudAllowed
    };
  }

  return {
    app: true,
    device: ["device", "app_device", "device_cloud", "all"].includes(legacyScope),
    cloud: cloudAllowed && ["cloud", "app_cloud", "device_cloud", "all"].includes(legacyScope)
  };
};

export const projectWantsCloudBackup = (
  project: Pick<BodyProject, "saveMode"> | null | undefined,
  legacyEnabled: boolean
) => project?.saveMode ? isProjectCloudSaveMode(project.saveMode) : legacyEnabled;

export const canUploadLinkedProjectWork = ({
  photoIds,
  photos,
  projects,
  selectedProjectIds,
  legacyEnabled
}: {
  photoIds: readonly string[];
  photos: readonly { id: string; projectId?: string }[];
  projects: readonly Pick<BodyProject, "id" | "saveMode">[];
  selectedProjectIds: ReadonlySet<string>;
  legacyEnabled: boolean;
}) => {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const photoProjectId = new Map(photos.map((photo) => [photo.id, photo.projectId]));
  const linkedProjects = new Set(
    photoIds.map((photoId) => photoProjectId.get(photoId)).filter((id): id is string => Boolean(id))
  );
  if (linkedProjects.size === 0) return legacyEnabled;
  return [...linkedProjects].every(
    (projectId) =>
      selectedProjectIds.has(projectId) &&
      projectWantsCloudBackup(projectById.get(projectId), legacyEnabled)
  );
};
