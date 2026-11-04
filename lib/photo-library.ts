import { storeBodyFramePhotoFile } from "@/lib/body-frame-photo-storage";
import {
  finishBodyFrameCameraCapture,
  reserveBodyFrameCameraCapture,
  type ReservedBodyFrameCapture
} from "@/lib/body-frame-camera-session";
import { updateBodyProject } from "@/lib/body-project-library";
import {
  detachBodyMeasurementsFromPhoto,
  syncBodyMeasurementPhotoSequences
} from "@/lib/body-measurement-library";
import {
  deleteLocalFile,
  deletePhoto as deleteLegacyPhoto,
  discardPhotoDraft,
  updatePhotoMetadata,
  reorderProjectPhotos as reorderLegacyProjectPhotos,
  saveCapturedPhoto as saveLegacyCapturedPhoto
} from "@/lib/legacy-photo-library";
import type { PhotoItem, SaveCapturedPhotoInput } from "@/types/photo";

export * from "@/lib/legacy-photo-library";

export const deletePhoto = async (id: string) => {
  await detachBodyMeasurementsFromPhoto(id);
  return deleteLegacyPhoto(id);
};

export const reorderBodyProjectPhotos = async ({
  projectId,
  orderedPhotoIds
}: {
  projectId: string;
  orderedPhotoIds: string[];
}) => {
  const reordered = await reorderLegacyProjectPhotos({
    projectId,
    orderedPhotoIds
  });
  const sequenceByPhotoId = new Map(
    orderedPhotoIds.map((id, index) => [id, index + 1])
  );

  await syncBodyMeasurementPhotoSequences(projectId, sequenceByPhotoId);
  await updateBodyProject(projectId, {
    coverPhotoId: orderedPhotoIds[orderedPhotoIds.length - 1]
  }).catch(() => null);

  return reordered;
};

const cleanupOrphanProjectFiles = async (photo?: PhotoItem | null) => {
  if (!photo) {
    return;
  }

  await Promise.all([
    deleteLocalFile(photo.uri).catch(() => undefined),
    photo.previewUri
      ? deleteLocalFile(photo.previewUri).catch(() => undefined)
      : Promise.resolve()
  ]);
};

const rollbackLegacyProjectDraft = async (photo?: PhotoItem | null) => {
  if (!photo) {
    return;
  }

  const discarded = await discardPhotoDraft(photo.id, photo);
  if (discarded) await cleanupOrphanProjectFiles(discarded);
};

export const saveCapturedPhoto = async (
  input: SaveCapturedPhotoInput,
  captureReservation?: ReservedBodyFrameCapture | null
) => {
  const reserved = captureReservation === undefined ? reserveBodyFrameCameraCapture({
    projectId: input.projectId,
    sequence: input.sequence
  }) : captureReservation;

  if (!reserved) {
    return saveLegacyCapturedPhoto(input);
  }

  const resolvedProjectId = reserved.projectId;
  const resolvedSequence = reserved.sequence;
  let legacyPhoto: PhotoItem | null = null;
  let projectPhoto: PhotoItem | null = null;
  let stagedProjectPhoto: PhotoItem | null = null;

  try {
    legacyPhoto = await saveLegacyCapturedPhoto({
      ...input,
      localImageLimit: undefined,
      projectId: undefined,
      sequence: undefined
    }, { deferProjectOptimization: true });
    // Make the reservation available to an edit of this visible draft, including
    // when later project-file storage fails and that newer edit must survive.
    await updatePhotoMetadata(legacyPhoto.id, {
      projectId: resolvedProjectId,
      sequence: resolvedSequence
    }, legacyPhoto);
    legacyPhoto = { ...legacyPhoto, projectId: resolvedProjectId, sequence: resolvedSequence };

    const stored = await storeBodyFramePhotoFile({
      sourceUri: legacyPhoto.uri,
      projectId: resolvedProjectId,
      photoId: legacyPhoto.id,
      width: legacyPhoto.width,
      height: legacyPhoto.height
    });

    stagedProjectPhoto = {
      ...legacyPhoto,
      ...stored,
      projectId: resolvedProjectId,
      sequence: resolvedSequence,
      localUri: stored.uri,
      localPreviewUri: stored.previewUri,
      localFileStatus: "available"
    };

    projectPhoto = await updatePhotoMetadata(legacyPhoto.id, stagedProjectPhoto, legacyPhoto);
    if (projectPhoto.uri !== stagedProjectPhoto.uri) {
      await cleanupOrphanProjectFiles(stagedProjectPhoto);
    }

    await updateBodyProject(resolvedProjectId, {
      coverPhotoId: projectPhoto.id
    }).catch(() => null);

    if (legacyPhoto.uri !== projectPhoto.uri) {
      await deleteLocalFile(legacyPhoto.uri).catch(() => undefined);
    }
    if (
      legacyPhoto.previewUri &&
      legacyPhoto.previewUri !== projectPhoto.previewUri
    ) {
      await deleteLocalFile(legacyPhoto.previewUri).catch(() => undefined);
    }

    finishBodyFrameCameraCapture({
      reservationId: reserved.reservationId,
      projectId: resolvedProjectId,
      sequence: resolvedSequence,
      success: true
    });
    return projectPhoto;
  } catch (error) {
    try {
      if (stagedProjectPhoto && !projectPhoto) {
        await cleanupOrphanProjectFiles(stagedProjectPhoto);
      }
      if (legacyPhoto) {
        await rollbackLegacyProjectDraft(legacyPhoto);
      }
    } catch {
      // Preserve the original capture/save error; cleanup is best-effort.
    } finally {
      finishBodyFrameCameraCapture({
        reservationId: reserved.reservationId,
        sequence: resolvedSequence,
        success: false
      });
    }
    throw error;
  }
};
