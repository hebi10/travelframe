import { localStorageAdapter } from "@/lib/local-storage";
import {
  getBodyProjects,
  replaceBodyProjects
} from "@/lib/body-project-library";
import {
  getLastActiveProjectId,
  setLastActiveProjectId
} from "@/lib/body-project-preferences";
import {
  assignLegacyPhotosToProject,
  buildLegacyBodyProject,
  LEGACY_BODY_PROJECT_ID
} from "@/lib/body-frame-stage2-utils";
import {
  cleanupMigratedSourceFiles,
  migratePhotoFilesToProject
} from "@/lib/body-frame-photo-storage";
import { getPhotos, replacePhotosFromBackup } from "@/lib/photo-library";
import type { BodyProject } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

export const BODY_FRAME_STAGE2_MIGRATION_KEY = "body-frame.stage-2-migration.v1";

let migrationChain: Promise<BodyFrameStage2MigrationResult> | null = null;

export type BodyFrameStage2MigrationResult = {
  migratedPhotoCount: number;
  projectId: string | null;
  alreadyCurrent: boolean;
};

const hasProjectId = (photo: PhotoItem) =>
  typeof photo.projectId === "string" && photo.projectId.trim().length > 0;

const mergeLegacyProject = (
  projects: BodyProject[],
  generatedLegacyProject: BodyProject
): BodyProject[] => {
  const existing = projects.find((project) => project.id === LEGACY_BODY_PROJECT_ID);
  if (!existing) {
    return [generatedLegacyProject, ...projects];
  }

  const merged: BodyProject = {
    ...generatedLegacyProject,
    ...existing,
    targetPhotoCount: Math.max(
      existing.targetPhotoCount,
      generatedLegacyProject.targetPhotoCount
    ),
    coverPhotoId: generatedLegacyProject.coverPhotoId ?? existing.coverPhotoId,
    updatedAt: generatedLegacyProject.updatedAt
  };

  return projects.map((project) =>
    project.id === LEGACY_BODY_PROJECT_ID ? merged : project
  );
};

const migrate = async (): Promise<BodyFrameStage2MigrationResult> => {
  const [photos, projects, marker] = await Promise.all([
    getPhotos(),
    getBodyProjects(),
    localStorageAdapter.getItem(BODY_FRAME_STAGE2_MIGRATION_KEY)
  ]);
  const legacyPhotos = photos.filter((photo) => !hasProjectId(photo));

  if (legacyPhotos.length === 0) {
    if (marker !== "completed") {
      await localStorageAdapter.setItem(BODY_FRAME_STAGE2_MIGRATION_KEY, "completed");
    }

    const lastActiveProjectId = await getLastActiveProjectId();
    if (!lastActiveProjectId && projects[0]) {
      await setLastActiveProjectId(projects[0].id);
    }

    return {
      migratedPhotoCount: 0,
      projectId: projects[0]?.id ?? null,
      alreadyCurrent: marker === "completed"
    };
  }

  const assignedPhotos = assignLegacyPhotosToProject(
    photos,
    LEGACY_BODY_PROJECT_ID
  ) as PhotoItem[];
  const generatedLegacyProject = buildLegacyBodyProject(assignedPhotos) as BodyProject | null;
  if (!generatedLegacyProject) {
    throw new Error("기존 사진 프로젝트를 만들 수 없습니다.");
  }

  const legacyIds = new Set(legacyPhotos.map((photo) => photo.id));
  const migratedById = new Map<string, PhotoItem>();
  const obsoleteSourceUris: string[] = [];

  for (const photo of assignedPhotos) {
    if (
      !legacyIds.has(photo.id) ||
      photo.projectId !== LEGACY_BODY_PROJECT_ID ||
      typeof photo.sequence !== "number"
    ) {
      continue;
    }

    const migrated = await migratePhotoFilesToProject(
      photo as PhotoItem & { projectId: string; sequence: number }
    );
    migratedById.set(photo.id, migrated.photo);
    obsoleteSourceUris.push(...migrated.obsoleteSourceUris);
  }

  const migratedPhotos = assignedPhotos.map(
    (photo) => migratedById.get(photo.id) ?? photo
  );
  const nextProjects = mergeLegacyProject(projects, generatedLegacyProject);

  await replaceBodyProjects(nextProjects);
  await replacePhotosFromBackup(migratedPhotos);
  await cleanupMigratedSourceFiles(obsoleteSourceUris);

  const lastActiveProjectId = await getLastActiveProjectId();
  if (!lastActiveProjectId) {
    await setLastActiveProjectId(LEGACY_BODY_PROJECT_ID);
  }

  await localStorageAdapter.setItem(BODY_FRAME_STAGE2_MIGRATION_KEY, "completed");

  return {
    migratedPhotoCount: legacyPhotos.length,
    projectId: LEGACY_BODY_PROJECT_ID,
    alreadyCurrent: false
  };
};

export const ensureBodyFrameStage2Migration = async () => {
  if (!migrationChain) {
    migrationChain = migrate().finally(() => {
      migrationChain = null;
    });
  }

  return migrationChain;
};
