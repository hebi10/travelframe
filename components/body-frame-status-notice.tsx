import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/app-text";
import {
  bodyFrameDesign,
  bodyFrameTypography,
  getBodyFrameControlColors,
  getBodyFrameStatusColors
} from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";

type BodyFrameStatusNoticeProps = {
  variant: "loading" | "empty" | "error";
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function BodyFrameStatusNotice({
  variant,
  title,
  detail,
  actionLabel,
  onAction
}: BodyFrameStatusNoticeProps) {
  const { palette } = useAppAppearance();
  const { secondaryBorder } = getBodyFrameControlColors(palette);
  const statusColors = getBodyFrameStatusColors(palette);

  return (
    <View style={styles.notice}>
      {variant === "loading" ? (
        <ActivityIndicator size="small" color={palette.text} accessibilityLabel="불러오는 중" />
      ) : (
        <Feather
          name={variant === "error" ? "alert-circle" : "inbox"}
          size={bodyFrameDesign.iconSize + 4}
          color={variant === "error" ? statusColors.error : palette.muted}
        />
      )}
      <Text
        accessibilityLiveRegion={variant === "error" ? "assertive" : "polite"}
        style={[styles.title, { color: palette.text }]}
      >
        {title}
      </Text>
      {detail ? (
        <Text style={[styles.detail, { color: palette.muted }]}>
          {detail}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={[styles.action, { borderColor: secondaryBorder, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.actionText, { color: palette.text }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    width: "100%",
    maxWidth: 560,
    minHeight: 144,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingVertical: 20
  },
  title: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 26
  },
  detail: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 21,
    textAlign: "center"
  },
  action: {
    minHeight: bodyFrameDesign.minTouchSize,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  actionText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600",
    textAlign: "center"
  }
});
