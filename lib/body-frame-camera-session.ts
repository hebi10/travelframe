export type BodyFrameCameraSessionSnapshot = {
  projectId: string | null;
  sequence: number;
  automaticReferenceUri: string | null;
  projectRevision: number;
  pendingSaveCount: number;
  lastSavedSequence: number | null;
  lastSavedAt: number;
};

let snapshot: BodyFrameCameraSessionSnapshot = {
  projectId: null,
  sequence: 1,
  automaticReferenceUri: null,
  projectRevision: 0,
  pendingSaveCount: 0,
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

export const getBodyFrameCameraSessionSnapshot = () => snapshot;

export const subscribeBodyFrameCameraSession = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setBodyFrameCameraSession = ({
  projectId,
  sequence,
  automaticReferenceUri
}: {
  projectId: string;
  sequence: number;
  automaticReferenceUri?: string | null;
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
      : snapshot.projectRevision
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
    pendingSaveCount: 0
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
  sequence,
  success
}: {
  sequence: number;
  success: boolean;
}) => {
  setSnapshot({
    ...snapshot,
    pendingSaveCount: Math.max(0, snapshot.pendingSaveCount - 1),
    ...(success
      ? {
          lastSavedSequence: sequence,
          lastSavedAt: Date.now()
        }
      : {})
  });
};
