export type ReferencePhotoMode = "first" | "latest";

export type BodyProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  targetPhotoCount: number;
  referenceMode: ReferencePhotoMode;
  coverPhotoId?: string;
  archived: boolean;
};
