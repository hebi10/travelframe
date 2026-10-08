import {
  Text as NativeText,
  TextInput as NativeTextInput,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
  type TextProps
} from "react-native";

import { useAppAppearance } from "@/lib/app-appearance";
import { typography } from "@/constants/app-theme";

const useSelectedFontStyle = (style: StyleProp<TextStyle>): TextStyle | undefined => {
  const { fontFamily, settings, fontSizeScale } = useAppAppearance();
  const resolvedStyle = StyleSheet.flatten(style);
  const fontScaleStyle: TextStyle =
    fontSizeScale === 1
      ? {}
      : {
          fontSize: Math.round((resolvedStyle?.fontSize ?? typography.body) * fontSizeScale),
          ...(typeof resolvedStyle?.lineHeight === "number"
            ? { lineHeight: Math.round(resolvedStyle.lineHeight * fontSizeScale) }
            : {})
        };

  if (!fontFamily) {
    return fontScaleStyle;
  }

  return {
    ...fontScaleStyle,
    fontFamily,
    ...(settings.fontStyle === "noto_sans_kr"
      ? {}
      : { fontWeight: "400" as const })
  };
};

export function AppText({ style, ...props }: TextProps) {
  const selectedFontStyle = useSelectedFontStyle(style);

  return <NativeText {...props} style={[style, selectedFontStyle]} />;
}

export function AppTextInput({ style, ...props }: TextInputProps) {
  const selectedFontStyle = useSelectedFontStyle(style);

  return <NativeTextInput {...props} style={[style, selectedFontStyle]} />;
}
