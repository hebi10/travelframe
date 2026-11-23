import { deleteBodyMeasurement, getBodyMeasurements } from "@/lib/body-measurement-library";
import { deleteArchivedBodyProject } from "@/lib/body-project-library";
import { deletePhoto, getPhotos } from "@/lib/photo-library";
import { enqueueProjectCloudSync } from "@/lib/project-cloud-sync-queue";
import { cancelProjectReminder } from "@/lib/project-reminder";
import { deleteImageBundleWork, getImageBundleWorks } from "@/lib/work-library";
import { deleteMadeVideo, getMadeVideos } from "@/lib/video-library";

export const permanentlyDeleteArchivedProject = async (projectId: string, includeAccountBackup: boolean) => {
  await deleteArchivedBodyProject(projectId, async () => {
    const [photos, videos, measurements, imageWorks] = await Promise.all([
      getPhotos(), getMadeVideos(), getBodyMeasurements(projectId), getImageBundleWorks()
    ]);
    const projectPhotos = photos.filter((photo) => photo.projectId === projectId);
    const photoIds = new Set(projectPhotos.map((photo) => photo.id));
    const projectVideos = videos.filter((video) => video.projectId === projectId ||
      (!video.projectId && video.photoIds.length > 0 && video.photoIds.every((id) => photoIds.has(id))));
    await cancelProjectReminder(projectId);
    for (const work of imageWorks) {
      if (work.photoIds.length > 0 && work.photoIds.every((id) => photoIds.has(id))) {
        await deleteImageBundleWork(work.id);
      }
    }
    for (const video of projectVideos) await deleteMadeVideo(video.id, { projectDeletion: true });
    for (const entry of measurements) await deleteBodyMeasurement(entry.id, { projectDeletion: true });
    for (const photo of projectPhotos) await deletePhoto(photo.id, { projectDeletion: true });
    if (includeAccountBackup) await enqueueProjectCloudSync({ projectId, kind: "delete-project" });
  });
};
