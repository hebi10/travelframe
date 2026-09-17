type ProjectAwarePhoto = {
  id: string;
  createdAt: string;
  projectId?: string;
  sequence?: number;
  [key: string]: unknown;
};

export const LEGACY_BODY_PROJECT_ID = "legacy-photos";
export const LEGACY_BODY_PROJECT_NAME = "기존 사진";

export const sanitizeProjectPathSegment = (value: string) => {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "project";
};

export const formatProjectSequenceFileName = (sequence: number) => {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error("sequence must be a positive integer");
  }

  return `${String(sequence).padStart(3, "0")}.jpg`;
};

export const buildProjectPhotoRelativePath = (projectId: string, sequence: number) =>
  `photos/${sanitizeProjectPathSegment(projectId)}/${formatProjectSequenceFileName(sequence)}`;

export const buildProjectPreviewRelativePath = (projectId: string, sequence: number) =>
  `photo-previews/${sanitizeProjectPathSegment(projectId)}/${formatProjectSequenceFileName(sequence)}`;

const hasProjectId = (photo: ProjectAwarePhoto) =>
  typeof photo.projectId === "string" && photo.projectId.trim().length > 0;

const timestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const assignLegacyPhotosToProject = <T extends ProjectAwarePhoto>(
  photos: T[],
  projectId = LEGACY_BODY_PROJECT_ID
): T[] => {
  const sequenceById = new Map(
    photos
      .filter((photo) => !hasProjectId(photo))
      .sort((first, second) => {
        const createdAtDiff = timestamp(first.createdAt) - timestamp(second.createdAt);
        return createdAtDiff !== 0 ? createdAtDiff : first.id.localeCompare(second.id);
      })
      .map((photo, index) => [photo.id, index + 1] as const)
  );

  return photos.map((photo) => {
    const sequence = sequenceById.get(photo.id);
    if (!sequence) {
      return photo;
    }

    return {
      ...photo,
      projectId,
      sequence
    };
  });
};

export const buildLegacyBodyProject = (photos: ProjectAwarePhoto[]) => {
  const legacyPhotos = photos
    .filter((photo) => photo.projectId === LEGACY_BODY_PROJECT_ID)
    .sort((first, second) => {
      const createdAtDiff = timestamp(first.createdAt) - timestamp(second.createdAt);
      return createdAtDiff !== 0 ? createdAtDiff : first.id.localeCompare(second.id);
    });

  if (legacyPhotos.length === 0) {
    return null;
  }

  const first = legacyPhotos[0];
  const last = legacyPhotos[legacyPhotos.length - 1];

  return {
    id: LEGACY_BODY_PROJECT_ID,
    name: LEGACY_BODY_PROJECT_NAME,
    createdAt: first.createdAt,
    updatedAt: last.createdAt,
    targetPhotoCount: Math.max(100, legacyPhotos.length),
    referenceMode: "latest" as const,
    coverPhotoId: last.id,
    archived: false
  };
};
