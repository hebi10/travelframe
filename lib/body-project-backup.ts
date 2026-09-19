import type { BodyProject } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

export const isPhotoBackupCurrent = (
  photo: PhotoItem,
  backup?: Record<string, unknown>
) => Boolean(
  backup?.localId === photo.id &&
  backup.storagePath &&
  backup.backupStatus === "backed_up" &&
  backup.sourceUpdatedAt === (photo.updatedAt ?? photo.createdAt) &&
  backup.projectId === photo.projectId &&
  backup.sequence === photo.sequence
);

// Older backups may contain project IDs without the corresponding project document.
export const recoverMissingBodyProjects = (
  projects: BodyProject[],
  photos: PhotoItem[]
): BodyProject[] => {
  const result = new Map(projects.map(project => [project.id, project]));
  for (const photo of photos) {
    if (!photo.projectId || result.has(photo.projectId)) continue;
    const members = photos.filter(item => item.projectId === photo.projectId);
    const ordered = [...members].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    result.set(photo.projectId, {
      id: photo.projectId,
      name: "복원한 프로젝트",
      createdAt: ordered[0].createdAt,
      updatedAt: ordered[ordered.length - 1].createdAt,
      targetPhotoCount: Math.max(100, members.length),
      referenceMode: "latest",
      coverPhotoId: ordered[ordered.length - 1].id,
      archived: false
    });
  }
  return [...result.values()];
};
