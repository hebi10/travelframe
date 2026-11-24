export const PROJECT_PHOTO_BATCH = 36;

export const nextProjectPhotoCount = (current: number, total: number) =>
  Math.min(total, current + PROJECT_PHOTO_BATCH);
