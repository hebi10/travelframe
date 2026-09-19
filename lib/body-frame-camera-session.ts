export type BodyFrameCameraSessionSnapshot = {
  projectId: string | null;
  sequence: number;
  automaticReferenceUri: string | null;
  poseAlignmentEnabled: boolean;
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
  poseAlignmentEnabled: false,
  projectRevision: 0,
  pendingSaveCount: 0,
  projectPhotoCount: 0,
  maxProgressPhotos: null,
  captureBlockedReason: null,
  lastSavedSequence: null,
  lastSavedAt: 0
};

const listeners = new Set<() => void>();
const reservations = new Map<string, ReservedBodyFrameCapture>();
const nextProjectSequences = new Map<string, number>();
let nextReservationId = 0;

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

export const isBodyFrameCameraCaptureBlocked = () =>
  Boolean(snapshot.captureBlockedReason) ||
  (snapshot.maxProgressPhotos !== null &&
    snapshot.projectPhotoCount + [...reservations.values()].filter(
      (reservation) => reservation.projectId === snapshot.projectId
    ).length >=
      snapshot.maxProgressPhotos);

export const setBodyFrameCameraSession = ({
  projectId,
  sequence,
  automaticReferenceUri,
  poseAlignmentEnabled = false,
  projectPhotoCount = 0,
  maxProgressPhotos = null,
  captureBlockedReason = null
}: {
  projectId: string;
  sequence: number;
  automaticReferenceUri?: string | null;
  poseAlignmentEnabled?: boolean;
  projectPhotoCount?: number;
  maxProgressPhotos?: number | null;
  captureBlockedReason?: string | null;
}) => {
  const projectChanged = snapshot.projectId !== projectId;
  setSnapshot({
    ...snapshot,
    projectId,
    sequence: Math.max(
      Number.isInteger(sequence) && sequence > 0 ? sequence : 1,
      nextProjectSequences.get(projectId) ?? 1,
      ...[...reservations.values()]
        .filter((reservation) => reservation.projectId === projectId)
        .map((reservation) => reservation.sequence + 1)
    ),
    automaticReferenceUri: automaticReferenceUri ?? null,
    poseAlignmentEnabled: poseAlignmentEnabled === true,
    projectRevision: projectChanged
      ? snapshot.projectRevision + 1
      : snapshot.projectRevision,
    pendingSaveCount: reservations.size,
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
    poseAlignmentEnabled: false,
    projectRevision: snapshot.projectRevision + 1,
    pendingSaveCount: reservations.size,
    projectPhotoCount: 0,
    maxProgressPhotos: null,
    captureBlockedReason: null
  });
};

export type ReservedBodyFrameCapture = {
  reservationId: string;
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
  const requestedSequence =
    Number.isInteger(sequence) && Number(sequence) > 0
      ? Number(sequence)
      : snapshot.sequence;
  const resolvedSequence = Math.max(
    requestedSequence,
    resolvedProjectId ? nextProjectSequences.get(resolvedProjectId) ?? 1 : 1
  );

  if (!resolvedProjectId || !Number.isInteger(resolvedSequence) || resolvedSequence <= 0) {
    return null;
  }

  const isActiveBodyFrameProject = resolvedProjectId === snapshot.projectId;
  if (isActiveBodyFrameProject && isBodyFrameCameraCaptureBlocked()) {
    throw new Error(
      snapshot.captureBlockedReason ??
        "현재 플랜의 프로젝트 사진 한도에 도달했습니다."
    );
  }

  const reservation = {
    reservationId: String(++nextReservationId),
    projectId: resolvedProjectId,
    sequence: resolvedSequence
  };
  reservations.set(reservation.reservationId, reservation);
  nextProjectSequences.set(resolvedProjectId, resolvedSequence + 1);
  setSnapshot({
    ...snapshot,
    pendingSaveCount: snapshot.pendingSaveCount + 1,
    sequence:
      resolvedProjectId === snapshot.projectId
        ? Math.max(snapshot.sequence, resolvedSequence + 1)
        : snapshot.sequence
  });

  return reservation;
};

export const finishBodyFrameCameraCapture = ({
  reservationId,
  projectId,
  sequence,
  success
}: {
  reservationId?: string;
  projectId?: string | null;
  sequence: number;
  success: boolean;
}) => {
  const reservation = reservationId
    ? reservations.get(reservationId)
    : [...reservations.values()].find(
        (item) => item.sequence === sequence && (!projectId || item.projectId === projectId)
      );
  if (!reservation) return;
  reservations.delete(reservation.reservationId);
  projectId = reservation.projectId;
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
    pendingSaveCount: reservations.size,
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
