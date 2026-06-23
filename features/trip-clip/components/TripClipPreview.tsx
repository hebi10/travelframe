import type { Dispatch, SetStateAction } from "react";
import { Pressable, Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";

import { TripClipPreviewPlayer } from "@/components/trip-clip-preview-player";
import type { TripClipRatio, TripClipTransition } from "@/constants/trip-clip";
import { VIDEO_DURATION_LIMIT_MESSAGE } from "@/constants/video";
import { TimelineScrubber } from "@/features/trip-clip/trip-clip-screen.components";
import { transitionLabel } from "@/features/trip-clip/trip-clip-screen.helpers";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";
import { formatVideoDuration } from "@/lib/video-utils";
import type { PhotoItem } from "@/types/photo";

type PreviewFrameSize = {
  width: number;
  height: number;
};

type TripClipPreviewProps = {
  ratio: TripClipRatio;
  ratioAspect: Record<TripClipRatio, number>;
  setPreviewFrameSize: Dispatch<SetStateAction<PreviewFrameSize>>;
  activePhoto: PhotoItem | null;
  frameFitPreviewProps: Omit<Parameters<typeof TripClipPreviewPlayer>[0], "adjustEnabled"> | null;
  previewAdjustEnabled: boolean;
  setPreviewAdjustEnabled: Dispatch<SetStateAction<boolean>>;
  resetActivePhotoAdjustment: () => void;
  setIsFrameFitModalVisible: Dispatch<SetStateAction<boolean>>;
  isPreviewGuideMoving: boolean;
  previewGuideMoveGesture: Parameters<typeof GestureDetector>[0]["gesture"];
  isImportingPhotos: boolean;
  pickPhotosFromPreview: () => void | Promise<void>;
  selectedPhotoCount: number;
  totalDuration: number;
  transition: TripClipTransition;
  activeMusicLabel: string;
  videoDurationTooLong: boolean;
  isPlaying: boolean;
  stopPlayback: () => void;
  playClip: () => void | Promise<void>;
  jumpPhoto: (direction: -1 | 1) => void;
  resetPlayback: () => void;
  progressSeconds: number;
  playbackProgress: SharedValue<number>;
  seekPreview: (seconds: number) => void;
};

export function TripClipPreview({
  ratio,
  ratioAspect,
  setPreviewFrameSize,
  activePhoto,
  frameFitPreviewProps,
  previewAdjustEnabled,
  setPreviewAdjustEnabled,
  resetActivePhotoAdjustment,
  setIsFrameFitModalVisible,
  isPreviewGuideMoving,
  previewGuideMoveGesture,
  isImportingPhotos,
  pickPhotosFromPreview,
  selectedPhotoCount,
  totalDuration,
  transition,
  activeMusicLabel,
  videoDurationTooLong,
  isPlaying,
  stopPlayback,
  playClip,
  jumpPhoto,
  resetPlayback,
  progressSeconds,
  playbackProgress,
  seekPreview
}: TripClipPreviewProps) {
  return (
      <View style={styles.previewSection}>
        <View
          style={[styles.previewFrame, { aspectRatio: ratioAspect[ratio] }]}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewFrameSize({ width, height });
          }}
        >
          {activePhoto ? (
            <>
              {frameFitPreviewProps ? (
                <TripClipPreviewPlayer
                  {...frameFitPreviewProps}
                  adjustEnabled={previewAdjustEnabled}
                />
              ) : null}
              <Pressable
                style={[
                  styles.previewAdjustButton,
                  previewAdjustEnabled && styles.previewAdjustButtonActive
                ]}
                onPress={() => setPreviewAdjustEnabled(true)}
                accessibilityRole="button"
                accessibilityLabel="프레임 맞추기"
              >
                <Text
                  selectable={false}
                  style={[
                    styles.previewAdjustButtonText,
                    previewAdjustEnabled && styles.previewAdjustButtonTextActive
                  ]}
                >
                  프레임 맞추기
                </Text>
              </Pressable>
              {previewAdjustEnabled ? (
                <View style={styles.frameFitInlineActions}>
                  <Pressable
                    style={styles.frameFitInlineButton}
                    onPress={resetActivePhotoAdjustment}
                  >
                    <Text selectable={false} style={styles.frameFitInlineButtonText}>
                      초기화
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.frameFitInlineButton, styles.frameFitInlinePrimaryButton]}
                    onPress={() => {
                      setPreviewAdjustEnabled(true);
                      setIsFrameFitModalVisible(true);
                    }}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.frameFitInlineButtonText,
                        styles.frameFitInlinePrimaryButtonText
                      ]}
                    >
                      크게 편집
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.frameFitInlineButton}
                    onPress={() => setPreviewAdjustEnabled(false)}
                  >
                    <Text selectable={false} style={styles.frameFitInlineButtonText}>
                      완료
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {isPreviewGuideMoving ? (
                <GestureDetector gesture={previewGuideMoveGesture}>
                  <View
                    collapsable={false}
                    pointerEvents="box-only"
                    style={styles.previewGuideMoveLayer}
                  >
                    <Text selectable={false} style={styles.previewGuideMoveText}>
                      가이드를 손가락으로 드래그하세요
                    </Text>
                  </View>
                </GestureDetector>
              ) : null}
            </>
          ) : (
            <Pressable
              disabled={isImportingPhotos}
              style={({ pressed }) => [
                styles.emptyPreview,
                pressed && styles.emptyPreviewPressed,
                isImportingPhotos && styles.disabledButton
              ]}
              onPress={pickPhotosFromPreview}
            >
              <Text selectable numberOfLines={2} style={styles.emptyPreviewText}>
                {isImportingPhotos ? "사진을 불러오는 중" : "사진을 선택하세요"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.previewMeta}>
          <Text selectable style={styles.previewTitle}>
            사진 {selectedPhotoCount}장 / {totalDuration.toFixed(1)}초
          </Text>
          <Text selectable style={styles.previewDetail}>
            {ratio} / {transitionLabel(transition)} / {activeMusicLabel}
          </Text>
          {videoDurationTooLong ? (
            <Text selectable style={styles.durationWarningText}>
              {VIDEO_DURATION_LIMIT_MESSAGE}
            </Text>
          ) : null}
        </View>

        <View style={styles.playbackPanel}>
          <View style={styles.playbackTopRow}>
            <View style={styles.playbackSide}>
              <Pressable
                disabled={selectedPhotoCount === 0}
                style={[
                  styles.playToggleButton,
                  selectedPhotoCount === 0 && styles.disabledButton
                ]}
                onPress={isPlaying ? stopPlayback : playClip}
              >
                <Text selectable={false} style={styles.playToggleText}>
                  {isPlaying ? "멈춤" : "재생"}
                </Text>
              </Pressable>
              <Pressable style={styles.restartButton} onPress={() => jumpPhoto(-1)}>
                <Text selectable={false} style={styles.restartButtonText}>
                  이전
                </Text>
              </Pressable>
            </View>
            <Text selectable style={styles.timeText}>
              {formatVideoDuration(progressSeconds)} / {formatVideoDuration(totalDuration)}
            </Text>
            <View style={[styles.playbackSide, styles.playbackSideRight]}>
              <Pressable style={styles.restartButton} onPress={() => jumpPhoto(1)}>
                <Text selectable={false} style={styles.restartButtonText}>
                  다음
                </Text>
              </Pressable>
              <Pressable style={styles.restartButton} onPress={resetPlayback}>
                <Text selectable={false} style={styles.restartButtonText}>
                  처음
                </Text>
              </Pressable>
            </View>
          </View>
          <TimelineScrubber
            progressSeconds={progressSeconds}
            progressValue={playbackProgress}
            totalDuration={totalDuration}
            onSeek={seekPreview}
          />
        </View>
      </View>


  );
}
