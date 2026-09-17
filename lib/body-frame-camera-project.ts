type BodyProjectLike = {
  id: string;
  targetPhotoCount?: number;
  referenceMode?: "first" | "latest" | string;
  archived?: boolean;
};

type PhotoLike = {
  id: string;
  uri?: string;
  downloadURL?: string;
  createdAt?: string;
  projectId?: string;
  sequence?: number;
};

const isPositiveSequence = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const selectActiveBodyProject = <T extends BodyProjectLike>(
  projects: T[],
  lastActiveProjectId?: string | null
): T | null => {
  const availableProjects = projects.filter((project) => !project.archived);
  if (availableProjects.length === 0) {
    return null;
  }

  if (lastActiveProjectId) {
    const restored = availableProjects.find(
      (project) => project.id === lastActiveProjectId
    );
    if (restored) {
      return restored;
    }
  }

  return availableProjects[0] ?? null;
};

export const getBodyProjectPhotos = <T extends PhotoLike>(
  photos: T[],
  projectId: string
): T[] => photos.filter((photo) => photo.projectId === projectId);

export const getNextBodyProjectSequence = (
  photos: PhotoLike[],
  projectId: string
) => {
  const maxSequence = getBodyProjectPhotos(photos, projectId).reduce(
    (max, photo) =>
      isPositiveSequence(photo.sequence) ? Math.max(max, photo.sequence) : max,
    0
  );
  return maxSequence + 1;
};

const sortValidProjectPhotos = <T extends PhotoLike>(photos: T[]) =>
  photos
    .filter((photo) => isPositiveSequence(photo.sequence))
    .sort((first, second) => {
      const sequenceDiff = (first.sequence ?? 0) - (second.sequence ?? 0);
      if (sequenceDiff !== 0) {
        return sequenceDiff;
      }

      const createdAtDiff =
        new Date(first.createdAt ?? 0).getTime() -
        new Date(second.createdAt ?? 0).getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return first.id.localeCompare(second.id);
    });

export const selectBodyProjectReferencePhoto = <
  TPhoto extends PhotoLike,
  TProject extends BodyProjectLike
>(photos: TPhoto[], project: TProject): TPhoto | null => {
  const projectPhotos = sortValidProjectPhotos(
    getBodyProjectPhotos(photos, project.id)
  );
  if (projectPhotos.length === 0) {
    return null;
  }

  return project.referenceMode === "first"
    ? projectPhotos[0] ?? null
    : projectPhotos[projectPhotos.length - 1] ?? null;
};

export const getBodyProjectReferenceUri = (photo?: PhotoLike | null) => {
  if (!photo) {
    return null;
  }

  if (typeof photo.uri === "string" && photo.uri.length > 0) {
    return photo.uri;
  }

  if (typeof photo.downloadURL === "string" && photo.downloadURL.length > 0) {
    return photo.downloadURL;
  }

  return null;
};

export const getBodyProjectProgressSummary = <
  TProject extends BodyProjectLike
>(photos: PhotoLike[], project: TProject) => {
  const projectPhotos = getBodyProjectPhotos(photos, project.id);
  const photoCount = projectPhotos.length;
  return {
    photoCount,
    targetPhotoCount:
      typeof project.targetPhotoCount === "number" && project.targetPhotoCount > 0
        ? project.targetPhotoCount
        : 100,
    durationSeconds: Number((photoCount * 0.1).toFixed(1)),
    nextSequence: getNextBodyProjectSequence(photos, project.id)
  };
};
