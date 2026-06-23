import { Text } from "react-native";

import { TRIP_CLIP_RATIOS, TRIP_CLIP_TRANSITIONS, type TripClipRatio, type TripClipTransition } from "@/constants/trip-clip";
import { Chip, OptionRow, Section } from "@/features/trip-clip/trip-clip-screen.components";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";

type FadeOption = {
  label: string;
  value: number;
};

type TripClipVideoTabProps = {
  ratio: TripClipRatio;
  transition: TripClipTransition;
  transitionDuration: number;
  fadeOptions: readonly FadeOption[];
  updateTripClipRatio: (ratio: TripClipRatio) => void;
  setTransition: (transition: TripClipTransition) => void;
  setTransitionDuration: (duration: number) => void;
};

export function TripClipVideoTab({
  ratio,
  transition,
  transitionDuration,
  fadeOptions,
  updateTripClipRatio,
  setTransition,
  setTransitionDuration
}: TripClipVideoTabProps) {
  return (
      <Section title="영상 설정">
        <OptionRow>
          {TRIP_CLIP_RATIOS.map((item) => (
            <Chip
              key={item}
              label={item}
              active={ratio === item}
              onPress={() => updateTripClipRatio(item)}
            />
          ))}
        </OptionRow>
        <OptionRow>
          {TRIP_CLIP_TRANSITIONS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={transition === item.id}
              onPress={() => setTransition(item.id)}
            />
          ))}
        </OptionRow>
        {transition === "fade" ? (
          <>
            <Text selectable style={styles.settingDetail}>
              페이드 속도 {transitionDuration.toFixed(2)}초
            </Text>
            <OptionRow>
              {fadeOptions.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  active={transitionDuration === item.value}
                  onPress={() => setTransitionDuration(item.value)}
                />
              ))}
            </OptionRow>
          </>
        ) : null}
      </Section>
  );
}
