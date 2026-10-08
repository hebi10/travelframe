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
