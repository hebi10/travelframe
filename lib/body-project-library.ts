import { normalizeReferencePhotoMode } from "@/lib/body-frame-normalization";
import { localStorageAdapter } from "@/lib/local-storage";
import { enqueueProjectCloudSync } from "@/lib/project-cloud-sync-queue";
import { sanitizeProjectPathSegment } from "@/lib/body-frame-stage2-utils";
import type { BodyProject, ProjectSaveMode, ReferencePhotoMode } from "@/types/body-project";
import { isProjectSaveMode } from "@/lib/project-save-policy";

export const BODY_PROJECT_STORAGE_KEY = "body-frame.projects.v1";

let projectMutationChain = Promise.resolve();

const runProjectMutation = async <T>(operation: () => Promise<T>) => {
  const run = projectMutationChain.then(operation, operation);
  projectMutationChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

const normalizeIsoDate = (value: unknown, fallback: string) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? value : fallback;
};

const normalizeBodyProject = (value: unknown): BodyProject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawId = typeof record.id === "string" ? record.id.trim() : "";
  const id = sanitizeProjectPathSegment(rawId);
  if (!rawId || !id) {
    return null;
  }

  const now = new Date().toISOString();
  const createdAt = normalizeIsoDate(record.createdAt, now);
  const updatedAt = normalizeIsoDate(record.updatedAt, createdAt);
  const name =
    typeof record.name === "string" && record.name.trim().length > 0
      ? record.name.trim()
      : "새 프로젝트";
  const targetPhotoCount =
    typeof record.targetPhotoCount === "number" &&
    Number.isInteger(record.targetPhotoCount) &&
    record.targetPhotoCount > 0
      ? record.targetPhotoCount
      : 100;
  const coverPhotoId =
    typeof record.coverPhotoId === "string" && record.coverPhotoId.trim().length > 0
      ? record.coverPhotoId.trim()
      : undefined;

  return {
    id,
    name,
    createdAt,
    updatedAt,
    targetPhotoCount,
    referenceMode: normalizeReferencePhotoMode(record.referenceMode),
    ...(coverPhotoId ? { coverPhotoId } : {}),
    ...(isProjectSaveMode(record.saveMode) ? { saveMode: record.saveMode } : {}),
    ...(record.cloudResumeMode === "cloud" || record.cloudResumeMode === "local_cloud"
      ? { cloudResumeMode: record.cloudResumeMode }
      : {}),
    archived: record.archived === true
  };
};

const sortProjects = (projects: BodyProject[]) =>
  [...projects].sort(
    (first, second) =>
      new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  );

const parseProjects = (value: string | null): BodyProject[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortProjects(
      parsed
        .map((item) => normalizeBodyProject(item))
        .filter((item): item is BodyProject => Boolean(item))
    );
  } catch {
    return [];
  }
};

const writeProjects = async (projects: BodyProject[]) => {
  const normalized = projects
    .map((project) => normalizeBodyProject(project))
    .filter((project): project is BodyProject => Boolean(project));
  await localStorageAdapter.setItem(
    BODY_PROJECT_STORAGE_KEY,
    JSON.stringify(sortProjects(normalized))
  );
};

const createProjectId = () =>
  sanitizeProjectPathSegment(
    `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

export const getBodyProjects = async () => {
  const value = await localStorageAdapter.getItem(BODY_PROJECT_STORAGE_KEY);
  return parseProjects(value);
};

export const getBodyProjectById = async (id: string) => {
  const normalizedId = sanitizeProjectPathSegment(id);
  const projects = await getBodyProjects();
  return projects.find((project) => project.id === normalizedId) ?? null;
};

export const createBodyProject = async ({
  name,
  targetPhotoCount = 100,
  referenceMode = "latest",
  saveMode = "local_only"
}: {
  name: string;
  targetPhotoCount?: number;
  referenceMode?: ReferencePhotoMode;
  saveMode?: ProjectSaveMode;
}) =>
  runProjectMutation(async () => {
    const projects = await getBodyProjects();
    const now = new Date().toISOString();
    const project: BodyProject = {
      id: createProjectId(),
      name: name.trim() || "새 프로젝트",
      createdAt: now,
      updatedAt: now,
      targetPhotoCount:
        Number.isInteger(targetPhotoCount) && targetPhotoCount > 0 ? targetPhotoCount : 100,
      referenceMode,
      saveMode,
      archived: false
    };

    await writeProjects([project, ...projects]);
    return project;
  });

export const updateBodyProject = async (
  id: string,
  patch: Partial<Pick<BodyProject, "name" | "targetPhotoCount" | "referenceMode" | "coverPhotoId" | "saveMode">> & {
    cloudResumeMode?: BodyProject["cloudResumeMode"] | null;
  }
) =>
  runProjectMutation(async () => {
    const projects = await getBodyProjects();
    const normalizedId = sanitizeProjectPathSegment(id);
    let updatedProject: BodyProject | null = null;
    const nextProjects = projects.map((project) => {
      if (project.id !== normalizedId) {
        return project;
      }

      updatedProject = {
        ...project,
        ...(typeof patch.name === "string" && patch.name.trim().length > 0
          ? { name: patch.name.trim() }
          : {}),
        ...(typeof patch.targetPhotoCount === "number" &&
        Number.isInteger(patch.targetPhotoCount) &&
        patch.targetPhotoCount > 0
          ? { targetPhotoCount: patch.targetPhotoCount }
          : {}),
        ...(patch.referenceMode
          ? { referenceMode: normalizeReferencePhotoMode(patch.referenceMode) }
          : {}),
        ...(typeof patch.coverPhotoId === "string"
          ? { coverPhotoId: patch.coverPhotoId.trim() || undefined }
          : {}),
        ...(isProjectSaveMode(patch.saveMode) ? { saveMode: patch.saveMode } : {}),
        ...(patch.cloudResumeMode === null ||
        (isProjectSaveMode(patch.saveMode) && patch.saveMode !== "local_only")
          ? { cloudResumeMode: undefined }
          : patch.cloudResumeMode === "cloud" || patch.cloudResumeMode === "local_cloud"
            ? { cloudResumeMode: patch.cloudResumeMode }
            : {}),
        updatedAt: new Date().toISOString()
      };
      return updatedProject;
    });

    if (!updatedProject) {
      return null;
    }

    await writeProjects(nextProjects);
    if (patch.name !== undefined || patch.targetPhotoCount !== undefined ||
        patch.referenceMode !== undefined || patch.saveMode !== undefined) {
      await enqueueProjectCloudSync({ projectId: normalizedId, kind: "settings" })
        .catch(() => undefined);
    }
    return updatedProject;
  });

export const archiveBodyProject = async (id: string, archived = true) =>
  runProjectMutation(async () => {
    const projects = await getBodyProjects();
    const normalizedId = sanitizeProjectPathSegment(id);
    let updatedProject: BodyProject | null = null;
    const nextProjects = projects.map((project) => {
      if (project.id !== normalizedId) {
        return project;
      }

      updatedProject = {
        ...project,
        archived,
        updatedAt: new Date().toISOString()
      };
      return updatedProject;
    });

    if (!updatedProject) {
      return null;
    }

    await writeProjects(nextProjects);
    await enqueueProjectCloudSync({ projectId: normalizedId, kind: "settings" }).catch(() => undefined);
    return updatedProject;
  });

const DELETED_PROJECT_IDS_KEY = "body-frame.projects.deleted.v1";

export const getDeletedBodyProjectIds = async (): Promise<Set<string>> => {
  const raw = await localStorageAdapter.getItem(DELETED_PROJECT_IDS_KEY);
  if (!raw) return new Set();
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.some((id) => typeof id !== "string")) {
    throw new Error("삭제된 프로젝트 정보를 읽지 못했습니다.");
  }
  return new Set(data);
};

export const deleteArchivedBodyProject = (
  id: string,
  removeProjectData: () => Promise<void>
) => runProjectMutation(async () => {
  const projects = await getBodyProjects();
  const project = projects.find((item) => item.id === id);
  if (!project?.archived) throw new Error("보관 중인 프로젝트만 삭제할 수 있습니다.");
  await removeProjectData();
  const deletedIds = await getDeletedBodyProjectIds();
  deletedIds.add(id);
  await localStorageAdapter.setItem(DELETED_PROJECT_IDS_KEY, JSON.stringify([...deletedIds]));
  await writeProjects(projects.filter((item) => item.id !== id));
});

export const replaceBodyProjects = async (projects: BodyProject[]) => {
  await writeProjects(projects);
  return getBodyProjects();
};

export const mergeBodyProjectsFromBackup = async (projects: BodyProject[]) =>
  runProjectMutation(async () => {
    const current = await getBodyProjects();
    const existingIds = new Set([...current.map(project => project.id), ...await getDeletedBodyProjectIds()]);
    const incoming = projects
      .map(normalizeBodyProject)
      .filter((project): project is BodyProject => Boolean(project))
      .filter(project => !existingIds.has(project.id));
    await writeProjects([...current, ...incoming]);
    return getBodyProjects();
  });
