export type BodyFrameCameraSessionSnapshot = {
  projectId: string | null;
  sequence: number;
  automaticReferenceUri: string | null;
  projectRevision: number;
  pendingSaveCount: number;
  projectPhotoCount: number;
  maxProgressPhotos: number | null;
  captureBlockedReason: string | null;
  lastSavedSequence: number | null;
  lastSavedAt: number;
};

let snapshot: BodyFrameCameraSessionSnapshot = {
  projectId: null,
  sequence: 1,
  automaticReferenceUri: null,
  projectRevision: 0,
  pendingSaveCount: 0,
  projectPhotoCount: 0,
  maxProgressPhotos: null,
  captureBlockedReason: null,
  lastSavedSequence: null,
  lastSavedAt: 0
};

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setSnapshot = (next: BodyFrameCameraSessionSnapshot) => {
  snapshot = next;
  emit();
};

const normalizePhotoCount = (value: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const normalizePhotoLimit = (value: number | null | undefined) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value > 0
    ? value
    : null;

export const getBodyFrameCameraSessionSnapshot = () => snapshot;

export const subscribeBodyFrameCameraSession = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setBodyFrameCameraSession = ({
  projectId,
  sequence,
  automaticReferenceUri,
  projectPhotoCount = 0,
  maxProgressPhotos = null,
  captureBlockedReason = null
}: {
  projectId: string;
  sequence: number;
  automaticReferenceUri?: string | null;
  projectPhotoCount?: number;
  maxProgressPhotos?: number | null;
  captureBlockedReason?: string | null;
}) => {
  const projectChanged = snapshot.projectId !== projectId;
  setSnapshot({
    ...snapshot,
    projectId,
    sequence:
      Number.isInteger(sequence) && sequence > 0 ? sequence : 1,
    automaticReferenceUri: automaticReferenceUri ?? null,
    projectRevision: projectChanged
      ? snapshot.projectRevision + 1
      : snapshot.projectRevision,
    pendingSaveCount: projectChanged ? 0 : snapshot.pendingSaveCount,
    projectPhotoCount: normalizePhotoCount(projectPhotoCount),
    maxProgressPhotos: normalizePhotoLimit(maxProgressPhotos),
    captureBlockedReason:
      typeof captureBlockedReason === "string" && captureBlockedReason.length > 0
        ? captureBlockedReason
        : null
  });
};

export const clearBodyFrameCameraSession = () => {
  if (!snapshot.projectId && !snapshot.automaticReferenceUri) {
    return;
  }

  setSnapshot({
    ...snapshot,
    projectId: null,
    sequence: 1,
    automaticReferenceUri: null,
    projectRevision: snapshot.projectRevision + 1,
    pendingSaveCount: 0,
    projectPhotoCount: 0,
    maxProgressPhotos: null,
    captureBlockedReason: null
  });
};

export type ReservedBodyFrameCapture = {
  projectId: string;
  sequence: number;
};

export const reserveBodyFrameCameraCapture = ({
  projectId,
  sequence
}: {
  projectId?: string | null;
  sequence?: number | null;
} = {}): ReservedBodyFrameCapture | null => {
  const resolvedProjectId = projectId ?? snapshot.projectId;
  const resolvedSequence =
    Number.isInteger(sequence) && Number(sequence) > 0
      ? Number(sequence)
      : snapshot.sequence;

  if (!resolvedProjectId || !Number.isInteger(resolvedSequence) || resolvedSequence <= 0) {
    return null;
  }

  const isActiveBodyFrameProject = resolvedProjectId === snapshot.projectId;
  if (isActiveBodyFrameProject) {
    if (snapshot.captureBlockedReason) {
      throw new Error(snapshot.captureBlockedReason);
    }

    if (
      snapshot.maxProgressPhotos !== null &&
      snapshot.projectPhotoCount + snapshot.pendingSaveCount >=
        snapshot.maxProgressPhotos
    ) {
      throw new Error("현재 플랜의 프로젝트 사진 한도에 도달했습니다.");
    }
  }

  setSnapshot({
    ...snapshot,
    pendingSaveCount: snapshot.pendingSaveCount + 1,
    sequence:
      resolvedProjectId === snapshot.projectId
        ? Math.max(snapshot.sequence, resolvedSequence + 1)
        : snapshot.sequence
  });

  return {
    projectId: resolvedProjectId,
    sequence: resolvedSequence
  };
};

export const finishBodyFrameCameraCapture = ({
  projectId,
  sequence,
  success
}: {
  projectId?: string | null;
  sequence: number;
  success: boolean;
}) => {
  const savedIntoActiveProject =
    success && (!projectId || projectId === snapshot.projectId);
  const nextProjectPhotoCount = savedIntoActiveProject
    ? snapshot.projectPhotoCount + 1
    : snapshot.projectPhotoCount;
  const limitReached =
    snapshot.maxProgressPhotos !== null &&
    nextProjectPhotoCount >= snapshot.maxProgressPhotos;

  setSnapshot({
    ...snapshot,
    pendingSaveCount: Math.max(0, snapshot.pendingSaveCount - 1),
    projectPhotoCount: nextProjectPhotoCount,
    captureBlockedReason: limitReached
      ? snapshot.captureBlockedReason ??
        "현재 플랜의 프로젝트 사진 한도에 도달했습니다."
      : snapshot.captureBlockedReason,
    ...(success
      ? {
          lastSavedSequence: sequence,
          lastSavedAt: Date.now()
        }
      : {})
  });
};
