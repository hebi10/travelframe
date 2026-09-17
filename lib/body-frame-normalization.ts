export type NormalizedReferencePhotoMode = "first" | "latest";

export const normalizeReferencePhotoMode = (
  value: unknown
): NormalizedReferencePhotoMode => (value === "first" || value === "latest" ? value : "latest");

export const normalizeLastActiveProjectId = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeStoredPhotoItem = (
  value: unknown
): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const normalized = { ...(value as Record<string, unknown>) };
  const projectId = normalizeLastActiveProjectId(normalized.projectId);
  const sequence = normalized.sequence;

  if (projectId) {
    normalized.projectId = projectId;
  } else {
    delete normalized.projectId;
  }

  if (typeof sequence === "number" && Number.isInteger(sequence) && sequence > 0) {
    normalized.sequence = sequence;
  } else {
    delete normalized.sequence;
  }

  return normalized;
};
