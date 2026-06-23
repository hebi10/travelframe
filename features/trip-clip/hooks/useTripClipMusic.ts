import { useMemo } from "react";
import type { AudioSource } from "expo-audio";

import type { UserMusicTrack } from "@/lib/user-music";

export type MusicMode = "none" | "device";

export type CustomMusic = {
  uri: string;
  name: string;
  mimeType?: string;
};

type UseTripClipMusicInput = {
  musicMode: MusicMode;
  userMusicTracks: UserMusicTrack[];
  selectedUserMusicId: string | null;
};

export function useTripClipMusic({
  musicMode,
  userMusicTracks,
  selectedUserMusicId
}: UseTripClipMusicInput) {
  const selectedUserMusic =
    userMusicTracks.find((track) => track.id === selectedUserMusicId) ??
    userMusicTracks[0];

  const customMusic = useMemo<CustomMusic | null>(() => {
    if (musicMode !== "device" || !selectedUserMusic) {
      return null;
    }

    return {
      uri: selectedUserMusic.uri,
      name: selectedUserMusic.name,
      mimeType: selectedUserMusic.mimeType
    };
  }, [musicMode, selectedUserMusic]);

  const activeMusicSource = useMemo<AudioSource | undefined>(() => {
    if (musicMode === "device") {
      return customMusic ? { uri: customMusic.uri, name: customMusic.name } : undefined;
    }

    return undefined;
  }, [customMusic, musicMode]);

  const activeMusicLabel =
    musicMode === "device"
      ? customMusic?.name ?? "내 음악 선택"
      : "무음";

  return {
    selectedUserMusic,
    customMusic,
    activeMusicSource,
    activeMusicLabel
  };
}
