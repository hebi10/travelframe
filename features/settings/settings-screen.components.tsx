import { useMemo, useState } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";

import { typography } from "@/constants/app-theme";
import { GUIDE_SIZE_MAX, GUIDE_SIZE_MIN, getFontSizeScale, type FontSize, type FontStyle } from "@/lib/app-settings";
import { getFontWeightForStyle, useAppAppearance } from "@/lib/app-appearance";
import { getGuideSizeFromTrackX, clampSettingsGuideSize } from "@/features/settings/settings-screen.helpers";
import { createThemedStyles, styles } from "@/features/settings/settings-screen.styles";

export function OptionButton({
  label,
  detail,
  active,
  disabled = false,
  activeMarkFill = "filled",
  fontStylePreview,
  fontSizePreview,
  onPress
}: {
  label: string;
  detail: string;
  active: boolean;
  disabled?: boolean;
  activeMarkFill?: "filled" | "transparent";
  fontStylePreview?: FontStyle;
  fontSizePreview?: FontSize;
  onPress: () => void;
}) {
  const { palette, fontSizeScale, layoutScale, emphasisWeight } = useAppAppearance();
  const themed = useMemo(() => createThemedStyles(palette), [palette]);
  const previewFontSizeScale = fontSizePreview ? getFontSizeScale(fontSizePreview) : fontSizeScale;
  const previewFontWeight = fontStylePreview ? getFontWeightForStyle(fontStylePreview) : emphasisWeight;

  return (
    <Pressable
      style={[
        styles.option,
        themed.border,
        {
          minHeight: Math.round(72 * layoutScale),
          gap: Math.round(14 * layoutScale),
          paddingVertical: Math.round(14 * layoutScale),
          paddingHorizontal: Math.round(14 * layoutScale)
        },
        active && styles.optionActive,
        active && themed.activeBorder,
        disabled && styles.disabledButton
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={styles.optionCopy}>
        <Text
          selectable
          style={[
            styles.optionLabel,
            themed.text,
            {
              fontSize: Math.round(typography.body * previewFontSizeScale),
              lineHeight: Math.round(20 * previewFontSizeScale),
              fontWeight: previewFontWeight
            }
          ]}
        >
          {label}
        </Text>
        <Text
          selectable
          style={[
            styles.optionDetail,
            themed.mutedText,
            {
              fontSize: Math.round(typography.small * previewFontSizeScale),
              lineHeight: Math.round(17 * previewFontSizeScale),
              fontWeight: previewFontWeight
            }
          ]}
        >
          {detail}
        </Text>
      </View>
      <View
        style={[
          styles.optionMark,
          themed.optionMark,
          active &&
            (activeMarkFill === "transparent"
              ? themed.optionMarkActiveOutline
              : themed.optionMarkActive)
        ]}
      />
    </Pressable>
  );
}

export function SettingsGuideSizeSlider({
  value,
  onChange,
  onCommit
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const { palette } = useAppAppearance();
  const [trackWidth, setTrackWidth] = useState(1);
  const progress =
    ((clampSettingsGuideSize(value) - GUIDE_SIZE_MIN) /
      (GUIDE_SIZE_MAX - GUIDE_SIZE_MIN)) *
    100;
  const getEventValue = (event: GestureResponderEvent) =>
    getGuideSizeFromTrackX(event.nativeEvent.locationX, trackWidth);

  const handlePreview = (event: GestureResponderEvent) => {
    onChange(getEventValue(event));
  };

  const handleCommit = (event: GestureResponderEvent) => {
    onCommit(getEventValue(event));
  };

  return (
    <View style={styles.settingsGuideSizeSlider}>
      <View style={styles.settingsGuideSizeSliderHeader}>
        <Text selectable={false} style={[styles.settingsGuideSizeSliderLabel, { color: palette.muted }]}>
          드래그로 크기 조절
        </Text>
        <Text selectable={false} style={[styles.settingsGuideSizeSliderValue, { color: palette.text }]}>
          {Math.round(value)}
        </Text>
      </View>
      <View
        style={styles.settingsGuideSizeTrack}
        onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handlePreview}
        onResponderMove={handlePreview}
        onResponderRelease={handleCommit}
      >
        <View style={[styles.settingsGuideSizeTrackBase, { backgroundColor: palette.line }]} />
        <View
          style={[
            styles.settingsGuideSizeTrackFill,
            { backgroundColor: palette.text, width: `${progress}%` }
          ]}
        />
        <View
          style={[
            styles.settingsGuideSizeThumb,
            {
              borderColor: palette.text,
              backgroundColor: palette.background,
              left: `${progress}%`
            }
          ]}
        />
      </View>
      <View style={styles.settingsGuideSizeSliderRange}>
        <Text selectable={false} style={[styles.settingsGuideSizeSliderRangeText, { color: palette.muted }]}>
          {GUIDE_SIZE_MIN}
        </Text>
        <Text selectable={false} style={[styles.settingsGuideSizeSliderRangeText, { color: palette.muted }]}>
          {GUIDE_SIZE_MAX}
        </Text>
      </View>
    </View>
  );
}
