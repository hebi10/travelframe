import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/app-text";
import { bodyFrameAccent, bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";

type BodyFrameSheetHeaderProps = {
  title: string;
  description?: string;
  onClose: () => void;
  closeLabel?: string;
};

export function BodyFrameSheetHeader({
  title,
  description,
  onClose,
  closeLabel = "닫기"
}: BodyFrameSheetHeaderProps) {
  const { palette } = useAppAppearance();

  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: palette.muted }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        hitSlop={8}
        onPress={onClose}
        style={[styles.close, { borderColor: palette.line }]}
      >
        <Feather name="x" size={20} color={palette.text} />
      </Pressable>
    </View>
  );
}

type BodyFrameSheetFooterProps = {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel?: string;
  disabled?: boolean;
};

export function BodyFrameSheetFooter({
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel = "취소",
  disabled = false
}: BodyFrameSheetFooterProps) {
  const { palette, effectiveThemeMode } = useAppAppearance();
  const primaryBackground = effectiveThemeMode === "dark" ? bodyFrameAccent : palette.text;
  const primaryForeground = effectiveThemeMode === "dark" ? "#0B0B0C" : palette.inverse;

  return (
    <View style={styles.footer}>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={[styles.footerButton, { borderColor: palette.line, backgroundColor: palette.surface }]}
      >
        <Text style={[styles.footerText, { color: palette.text }]}>{cancelLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onConfirm}
        style={[
          styles.footerButton,
          { borderColor: primaryBackground, backgroundColor: primaryBackground, opacity: disabled ? 0.5 : 1 }
        ]}
      >
        <Text style={[styles.footerText, { color: primaryForeground }]}>{confirmLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: bodyFrameTypography.sectionTitle, fontWeight: "600" },
  description: { fontSize: bodyFrameTypography.caption, lineHeight: 18 },
  close: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  footer: { flexDirection: "row", gap: 10 },
  footerButton: {
    flex: 1,
    minHeight: bodyFrameDesign.primaryButtonHeight,
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius,
    alignItems: "center",
    justifyContent: "center"
  },
  footerText: { fontSize: bodyFrameTypography.button, fontWeight: "700" }
});
