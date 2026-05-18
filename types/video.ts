import type { MusicTrack, TripClipRatio, TripClipTemplate, TripClipTransition } from "@/constants/trip-clip";
import type { BackupMetadata } from "@/types/photo";

export type MadeVideoItem = BackupMetadata & {
  id: string;
  uri: string;
  coverUri?: string;
  createdAt: string;
  title: string;
  ratio: TripClipRatio;
  template: TripClipTemplate;
  transition: TripClipTransition;
  transitionDuration: number;
  duration: number;
  photoIds: string[];
  durations: Record<string, number>;
  musicId: MusicTrack["id"] | "custom";
  musicLabel: string;
};
