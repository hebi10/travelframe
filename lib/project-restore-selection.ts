export type ProjectRestoreSelectionInput<
  P extends { id: string },
  F extends { id: string; projectId?: string },
  W extends { photoIds: string[] },
  V extends { projectId?: string; photoIds: string[] },
  M extends { projectId: string },
  S extends { projectId: string }
> = {
  requestedProjectIds?: string[];
  projects: P[];
  photos: F[];
  imageWorks: W[];
  videos: V[];
  measurements: M[];
  settings: S[];
};

export const selectCloudProjectRestoreItems = <
  P extends { id: string },
  F extends { id: string; projectId?: string },
  W extends { photoIds: string[] },
  V extends { projectId?: string; photoIds: string[] },
  M extends { projectId: string },
  S extends { projectId: string }
>(
  input: ProjectRestoreSelectionInput<P, F, W, V, M, S>
) => {
  const {
    requestedProjectIds,
    projects,
    photos,
    imageWorks,
    videos,
    measurements,
    settings
  } = input;

  if (requestedProjectIds === undefined) {
    return { projects, photos, imageWorks, videos, measurements, settings };
  }

  const selected = new Set(requestedProjectIds);
  const available = new Set(projects.map((project) => project.id));
  if (selected.size === 0 || [...selected].some((id) => !id || !available.has(id))) {
    throw new Error("선택한 프로젝트의 클라우드 백업을 찾을 수 없습니다.");
  }

  const selectedPhotos = photos.filter((photo) =>
    Boolean(photo.projectId && selected.has(photo.projectId))
  );
  const selectedPhotoIds = new Set(selectedPhotos.map((photo) => photo.id));
  const onlySelectedPhotos = (item: { photoIds: string[] }) =>
    Array.isArray(item.photoIds) &&
    item.photoIds.length > 0 &&
    item.photoIds.every((photoId) => selectedPhotoIds.has(photoId));

  return {
    projects: projects.filter((project) => selected.has(project.id)),
    photos: selectedPhotos,
    imageWorks: imageWorks.filter(onlySelectedPhotos),
    videos: videos.filter((video) =>
      video.projectId ? selected.has(video.projectId) : onlySelectedPhotos(video)
    ),
    measurements: measurements.filter((entry) => selected.has(entry.projectId)),
    settings: settings.filter((entry) => selected.has(entry.projectId))
  };
};
