import type { PhotoItem } from "@/types/photo";
import type { BodyMeasurementEntry, BodyMeasurementSettings } from "@/types/body-measurement";

export type CaptureMeasurementPrompt = {
  photo: PhotoItem;
  projectName: string;
  settings: BodyMeasurementSettings;
  entry: BodyMeasurementEntry | null;
};

export const createCaptureMeasurementPromptQueue = ({
  load,
  onChange
}: {
  load: (photo: PhotoItem) => Promise<CaptureMeasurementPrompt | null>;
  onChange: (items: CaptureMeasurementPrompt[]) => void;
}) => {
  const seenPhotoIds = new Set<string>();
  const dismissedPhotoIds = new Set<string>();
  let queue: CaptureMeasurementPrompt[] = [];
  let pending = Promise.resolve();

  const enqueue = (photo: PhotoItem): Promise<boolean> => {
    if (!photo.projectId || seenPhotoIds.has(photo.id)) return Promise.resolve(false);
    seenPhotoIds.add(photo.id);

    const operation = pending.then(async () => {
      const prompt = await load(photo);
      if (!prompt || dismissedPhotoIds.has(photo.id)) return false;
      queue = [...queue, prompt];
      onChange([...queue]);
      return true;
    });
    pending = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const dismiss = (photoId: string) => {
    dismissedPhotoIds.add(photoId);
    const next = queue.filter((prompt) => prompt.photo.id !== photoId);
    if (next.length === queue.length) return;
    queue = next;
    onChange([...queue]);
  };

  return {
    enqueue,
    dismiss,
    getItems: () => [...queue]
  };
};
