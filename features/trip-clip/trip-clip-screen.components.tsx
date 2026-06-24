import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";

import { colors } from "@/constants/app-theme";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text selectable style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function OptionRow({ children }: { children: ReactNode }) {
  return <View style={styles.optionRow}>{children}</View>;
}

export function Chip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text selectable={false} style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TimelineScrubber({
  progressSeconds,
  progressValue,
  totalDuration,
  onSeek
}: {
  progressSeconds: number;
  progressValue: SharedValue<number>;
  totalDuration: number;
  onSeek: (seconds: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progressRatio =
    totalDuration > 0 ? Math.max(0, Math.min(1, progressSeconds / totalDuration)) : 0;
  const progress = useSharedValue(progressRatio);
  const isScrubbing = useSharedValue(false);

  useEffect(() => {
    if (isScrubbing.value) {
      return;
    }

    progress.value = progressRatio;
    progressValue.value = progressSeconds;
  }, [isScrubbing, progress, progressRatio, progressSeconds, progressValue]);

  const commitSeek = useCallback(
    (ratio: number) => {
      onSeek(ratio * totalDuration);
    },
    [onSeek, totalDuration]
  );

  const scrubberGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(trackWidth > 0 && totalDuration > 0)
        .minDistance(0)
        .onBegin((event) => {
          isScrubbing.value = true;
          const ratio = Math.max(0, Math.min(1, event.x / trackWidth));
          progress.value = ratio;
          progressValue.value = ratio * totalDuration;
        })
        .onUpdate((event) => {
          const ratio = Math.max(0, Math.min(1, event.x / trackWidth));
          progress.value = ratio;
          progressValue.value = ratio * totalDuration;
        })
        .onFinalize(() => {
          isScrubbing.value = false;
          runOnJS(commitSeek)(progress.value);
        }),
    [commitSeek, isScrubbing, progress, progressValue, totalDuration, trackWidth]
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: `${(totalDuration > 0 ? progressValue.value / totalDuration : progress.value) * 100}%`
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${(totalDuration > 0 ? progressValue.value / totalDuration : progress.value) * 100}%`
  }));

  return (
    <GestureDetector gesture={scrubberGesture}>
      <Reanimated.View
        style={styles.scrubber}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.scrubberBase} />
        <Reanimated.View style={[styles.scrubberFill, fillStyle]} />
        <Reanimated.View style={[styles.scrubberThumb, thumbStyle]} />
      </Reanimated.View>
    </GestureDetector>
  );
}

export function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.smallButton} onPress={onPress}>
      <Text selectable={false} style={styles.smallButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TimelineDurationControl({
  duration,
  editing,
  onBeginEditing
}: {
  duration: number;
  editing: boolean;
  onBeginEditing: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="노출 시간 숫자로 수정"
      hitSlop={8}
      style={{
        alignSelf: "flex-start",
        minHeight: 30,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 4,
        paddingRight: 8
      }}
      onPress={onBeginEditing}
    >
      <Text
        selectable={false}
        style={[styles.timelineDetail, editing && styles.timelineDurationDetailEditing]}
      >
        {duration.toFixed(1)}초
      </Text>
      <Feather
        name="edit-2"
        size={13}
        color={editing ? colors.text : colors.muted}
        style={{ marginTop: 1 }}
      />
    </Pressable>
  );
}
