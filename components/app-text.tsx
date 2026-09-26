import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps
} from "react-native";

import { useAppAppearance } from "@/lib/app-appearance";

const useSelectedFontStyle = () => {
  const { fontFamily, settings } = useAppAppearance();

  if (!fontFamily) {
    return undefined;
  }

  return {
    fontFamily,
    ...(settings.fontStyle === "noto_sans_kr"
      ? {}
      : { fontWeight: "400" as const })
  };
};

export function AppText({ style, ...props }: TextProps) {
  const selectedFontStyle = useSelectedFontStyle();

  return <NativeText {...props} style={[style, selectedFontStyle]} />;
}

export function AppTextInput({ style, ...props }: TextInputProps) {
  const selectedFontStyle = useSelectedFontStyle();

  return <NativeTextInput {...props} style={[style, selectedFontStyle]} />;
}
