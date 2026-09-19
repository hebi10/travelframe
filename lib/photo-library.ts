import { storeBodyFramePhotoFile } from "@/lib/body-frame-photo-storage";
import {
  finishBodyFrameCameraCapture,
  reserveBodyFrameCameraCapture,
  type ReservedBodyFrameCapture
} from "@/lib/body-frame-camera-session";
import { updateBodyProject } from "@/lib/body-project-library";
import { detachBodyMeasurementsFromPhoto } from "@/lib/body-measurement-library";
import {
  deleteLocalFile,
  deletePhoto as deleteLegacyPhoto,
  getPhotos,
  replacePhotosFromBackup,
  saveCapturedPhoto as saveLegacyCapturedPhoto
} from "@/lib/legacy-photo-library";
import type { PhotoItem, SaveCapturedPhotoInput } from "@/types/photo";

export * from "@/lib/legacy-photo-library";

export const deletePhoto = async (id: string) => {
  await detachBodyMeasurementsFromPhoto(id);
  return deleteLegacyPhoto(id);
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

  const photos = await getPhotos();
  await replacePhotosFromBackup(
    photos.filter((item) => item.id !== photo.id)
  );
  await cleanupOrphanProjectFiles(photo);
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

  try {
    legacyPhoto = await saveLegacyCapturedPhoto({
      ...input,
      localImageLimit: undefined,
      projectId: undefined,
      sequence: undefined
    });

    const stored = await storeBodyFramePhotoFile({
      sourceUri: legacyPhoto.uri,
      projectId: resolvedProjectId,
      sequence: resolvedSequence,
      width: legacyPhoto.width,
      height: legacyPhoto.height
    });

    projectPhoto = {
      ...legacyPhoto,
      ...stored,
      projectId: resolvedProjectId,
      sequence: resolvedSequence,
      localUri: stored.uri,
      localPreviewUri: stored.previewUri,
      localFileStatus: "available"
    };

    const photos = await getPhotos();
    await replacePhotosFromBackup(
      photos.map((photo) =>
        photo.id === legacyPhoto?.id ? projectPhoto ?? photo : photo
      )
    );

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
      if (projectPhoto) {
        await cleanupOrphanProjectFiles(projectPhoto);
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
