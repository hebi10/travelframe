import type { PhotoItem } from "@/types/photo";

export const getBodyFrameComparisonPhotos = <T extends Pick<PhotoItem, "id" | "projectId" | "sequence" | "createdAt">>(
  photos: T[],
  projectId: string
): { before: T; after: T } | null => {
  const ordered = photos
    .filter(
      (photo) =>
        photo.projectId === projectId &&
        typeof photo.sequence === "number" &&
        Number.isInteger(photo.sequence) &&
        photo.sequence > 0
    )
    .sort((a, b) =>
      (a.sequence ?? 0) - (b.sequence ?? 0) ||
      (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
      a.id.localeCompare(b.id)
    );

  if (ordered.length < 2) return null;
  return { before: ordered[0], after: ordered[ordered.length - 1] };
};

export const getBodyFrameComparisonCandidates = <T extends Pick<PhotoItem, "id" | "projectId" | "sequence" | "createdAt" | "uri">>(
  photos: T[],
  projectId: string
): T[] => photos
  .filter(photo =>
    photo.projectId === projectId &&
    typeof photo.id === "string" && photo.id.length > 0 &&
    typeof photo.uri === "string" && photo.uri.length > 0 &&
    typeof photo.sequence === "number" &&
    Number.isInteger(photo.sequence) &&
    photo.sequence > 0
  )
  .sort((a, b) =>
    (a.sequence ?? 0) - (b.sequence ?? 0) ||
    (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
    a.id.localeCompare(b.id)
  );

export const selectBodyFrameComparisonPhotos = <T extends Pick<PhotoItem, "id" | "projectId" | "sequence" | "createdAt" | "uri">>(
  photos: T[],
  projectId: string,
  beforeId: string,
  afterId: string
): { before: T; after: T } | null => {
  if (!beforeId || !afterId || beforeId === afterId) return null;
  const candidates = getBodyFrameComparisonCandidates(photos, projectId);
  const before = candidates.find(photo => photo.id === beforeId);
  const after = candidates.find(photo => photo.id === afterId);
  return before && after && (before.sequence ?? 0) < (after.sequence ?? 0)
    ? { before, after }
    : null;
};
