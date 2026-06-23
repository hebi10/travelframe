import type { AudioSource } from "expo-audio";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "@/constants/app-theme";
import { Section } from "@/features/trip-clip/trip-clip-screen.components";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";
import type { UserMusicTrack } from "@/lib/user-music";

type MusicMode = "none" | "device";

type TripClipMusicTabProps = {
  musicMode: MusicMode;
  setMusicMode: (mode: MusicMode) => void;
  setExportMessage: (message: string | null) => void;
  userMusicTracks: UserMusicTrack[];
  selectedUserMusic: UserMusicTrack | null;
  setSelectedUserMusicId: (id: string | null) => void;
  isMusicSubmitting: boolean;
  musicTrackLimit: number;
  handleAddUserMusic: () => void | Promise<void>;
  activeMusicLabel: string;
  activeMusicSource: AudioSource | undefined;
  isPlaying: boolean;
  stopPlayback: () => void;
  playClip: () => void | Promise<void>;
};

export function TripClipMusicTab({
  musicMode,
  setMusicMode,
  setExportMessage,
  userMusicTracks,
  selectedUserMusic,
  setSelectedUserMusicId,
  isMusicSubmitting,
  musicTrackLimit,
  handleAddUserMusic,
  activeMusicLabel,
  activeMusicSource,
  isPlaying,
  stopPlayback,
  playClip
}: TripClipMusicTabProps) {
  return (
      <Section title="음악">
        <View style={styles.musicList}>
          <Pressable
            style={[styles.musicRow, musicMode === "none" && styles.musicRowActive]}
            onPress={() => {
              setMusicMode("none");
              setExportMessage(null);
            }}
          >
            <View style={styles.musicCopy}>
              <Text selectable style={styles.musicTitle}>
                무음
              </Text>
              <Text selectable style={styles.musicDetail}>
                배경음악 없이 사진 전환만 재생합니다.
              </Text>
            </View>
            {musicMode === "none" ? <View style={styles.musicMark} /> : null}
          </Pressable>
          {userMusicTracks.map((track) => {
            const isActive = musicMode === "device" && selectedUserMusic?.id === track.id;

            return (
              <Pressable
                key={track.id}
                style={[styles.musicRow, isActive && styles.musicRowActive]}
                onPress={() => {
                  setSelectedUserMusicId(track.id);
                  setMusicMode("device");
                  setExportMessage(null);
                }}
              >
                <View style={styles.musicCopy}>
                  <Text selectable style={styles.musicTitle}>
                    {track.name}
                  </Text>
                  <Text selectable style={styles.musicDetail}>
                    추가된 음악
                  </Text>
                </View>
                {isActive ? <View style={styles.musicMark} /> : null}
              </Pressable>
            );
          })}
          <Pressable
            disabled={
              isMusicSubmitting ||
              musicTrackLimit <= 0 ||
              userMusicTracks.length >= musicTrackLimit
            }
            style={[
              styles.musicRow,
              styles.musicAddRow,
              (isMusicSubmitting ||
                musicTrackLimit <= 0 ||
                userMusicTracks.length >= musicTrackLimit) &&
                styles.disabledButton
            ]}
            onPress={handleAddUserMusic}
          >
            <View style={styles.musicCopy}>
              <Text selectable style={styles.musicTitle}>
                내 음악 추가
              </Text>
              <Text selectable style={styles.musicDetail}>
                파일 앱의 오디오에서 음악 파일을 선택합니다.
              </Text>
            </View>
            {isMusicSubmitting ? <ActivityIndicator color={colors.text} /> : null}
          </Pressable>
        </View>
        <View style={styles.volumeControls}>
          <Text selectable style={styles.musicTitle}>
            현재 음악
          </Text>
          <Text selectable style={styles.musicDetail}>
            {activeMusicLabel}
          </Text>
          <Pressable
            disabled={!activeMusicSource}
            style={[styles.musicPickButton, !activeMusicSource && styles.disabledButton]}
            onPress={() => {
              if (!activeMusicSource) {
                return;
              }

              if (isPlaying) {
                stopPlayback();
                return;
              }

              void playClip();
            }}
          >
            <Text selectable={false} style={styles.musicPickButtonText}>
              {isPlaying ? "정지" : "음악 미리듣기"}
            </Text>
          </Pressable>
        </View>
      </Section>
  );
}
