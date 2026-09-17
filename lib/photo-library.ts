import { storeBodyFramePhotoFile } from "@/lib/body-frame-photo-storage";
import {
  finishBodyFrameCameraCapture,
  reserveBodyFrameCameraCapture
} from "@/lib/body-frame-camera-session";
import { updateBodyProject } from "@/lib/body-project-library";
import {
  deleteLocalFile,
  getPhotos,
  replacePhotosFromBackup,
  saveCapturedPhoto as saveLegacyCapturedPhoto
} from "@/lib/legacy-photo-library";
import type { PhotoItem, SaveCapturedPhotoInput } from "@/types/photo";

export * from "@/lib/legacy-photo-library";

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

export const saveCapturedPhoto = async (input: SaveCapturedPhotoInput) => {
  const reserved = reserveBodyFrameCameraCapture({
    projectId: input.projectId,
    sequence: input.sequence
  });

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
      sequence: resolvedSequence,
      success: true
    });
    return projectPhoto;
  } catch (error) {
    if (projectPhoto) {
      await cleanupOrphanProjectFiles(projectPhoto);
    }
    if (legacyPhoto) {
      await rollbackLegacyProjectDraft(legacyPhoto);
    }
    finishBodyFrameCameraCapture({
      sequence: resolvedSequence,
      success: false
    });
    throw error;
  }
};
