import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { typography } from "@/constants/app-theme";
import { getFontSizeScale, type FontSize, type FontStyle } from "@/lib/app-settings";
import { getFontWeightForStyle, useAppAppearance } from "@/lib/app-appearance";
import { getFontFamilyForStyle, useAppFontsReady } from "@/lib/app-fonts";
import { createThemedStyles, styles } from "@/features/settings/settings-screen.styles";

export function OptionButton({
  label,
  detail,
  active,
  disabled = false,
  activeMarkFill = "filled",
  fontStylePreview,
  fontFamilyPreview,
  fontSizePreview,
  onPress
}: {
  label: string;
  detail: string;
  active: boolean;
  disabled?: boolean;
  activeMarkFill?: "filled" | "transparent";
  fontStylePreview?: FontStyle;
  fontFamilyPreview?: FontStyle;
  fontSizePreview?: FontSize;
  onPress: () => void;
}) {
  const { palette, fontSizeScale, layoutScale, fontFamily, emphasisWeight } = useAppAppearance();
  const fontsReady = useAppFontsReady();
  const themed = useMemo(
    () => createThemedStyles(palette, fontFamily),
    [palette, fontFamily]
  );
  const previewFontSizeScale = fontSizePreview ? getFontSizeScale(fontSizePreview) : fontSizeScale;
  const previewFontStyle = fontStylePreview ?? fontFamilyPreview;
  const previewFontWeight = previewFontStyle ? getFontWeightForStyle(previewFontStyle) : emphasisWeight;
  const previewFontFamily =
    fontFamilyPreview ? getFontFamilyForStyle(fontFamilyPreview, fontsReady) : fontFamily;

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
              fontFamily: previewFontFamily,
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
              fontFamily: previewFontFamily,
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
