import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/app-text";
import { bodyFrameDesign, bodyFrameSheetDesign, bodyFrameTypography, getBodyFrameControlColors } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";

export function BodyFrameSheetHandle() {
  const { palette } = useAppAppearance();
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[styles.handle, { backgroundColor: palette.faint }]}
    />
  );
}

type BodyFrameSheetHeaderProps = {
  title: string;
  description?: string;
  onClose: () => void;
  closeLabel?: string;
  compactTypography?: boolean;
};

export function BodyFrameSheetHeader({
  title,
  description,
  onClose,
  closeLabel = "닫기",
  compactTypography = false
}: BodyFrameSheetHeaderProps) {
  const { palette } = useAppAppearance();

  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, compactTypography && styles.compactTitle, { color: palette.text }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, compactTypography && styles.compactDescription, { color: palette.muted }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        hitSlop={8}
        onPress={onClose}
        style={[styles.close, compactTypography && styles.compactClose, { borderColor: palette.line }]}
      >
        <Feather name="x" size={bodyFrameDesign.iconSize} color={palette.text} />
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
  confirmFlex?: number;
  compactTypography?: boolean;
};

export function BodyFrameSheetFooter({
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel = "취소",
  disabled = false,
  confirmFlex = 1,
  compactTypography = false
}: BodyFrameSheetFooterProps) {
  const { palette } = useAppAppearance();
  const {
    primaryBackground,
    primaryText: primaryForeground,
    secondaryBackground,
    secondaryBorder
  } = getBodyFrameControlColors(palette);

  return (
    <View style={styles.footer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        onPress={onCancel}
        style={[styles.footerButton, compactTypography && styles.compactFooterButton, { borderColor: secondaryBorder, backgroundColor: secondaryBackground }]}
      >
        <Text numberOfLines={2} style={[styles.footerText, compactTypography && styles.compactFooterText, { color: palette.text }]}>{cancelLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={confirmLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onConfirm}
        style={[
          styles.footerButton,
          compactTypography && styles.compactFooterButton,
          { flex: confirmFlex, borderColor: primaryBackground, backgroundColor: primaryBackground, opacity: disabled ? 0.5 : 1 }
        ]}
      >
        <Text numberOfLines={2} style={[styles.footerText, compactTypography && styles.compactFooterText, { color: primaryForeground }]}>{confirmLabel}</Text>
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
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: bodyFrameTypography.sectionTitle, fontWeight: "600" },
  description: { fontSize: bodyFrameTypography.caption, lineHeight: 18 },
  compactTitle: { fontSize: 20, lineHeight: 28, fontWeight: "700", includeFontPadding: false },
  compactDescription: { includeFontPadding: false },
  compactClose: { flexShrink: 0, borderRadius: 12 },
  close: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  handle: {
    alignSelf: "center",
    width: bodyFrameSheetDesign.handleWidth,
    height: bodyFrameSheetDesign.handleHeight,
    borderRadius: bodyFrameSheetDesign.handleRadius,
    marginBottom: 10
  },
  footer: {
    flexDirection: "row",
    gap: bodyFrameSheetDesign.footerGap
  },
  footerButton: {
    flex: 1,
    minWidth: 0,
    minHeight: bodyFrameDesign.primaryButtonHeight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.buttonRadius,
    alignItems: "center",
    justifyContent: "center"
  },
  footerText: { fontSize: bodyFrameTypography.button, fontWeight: "700", textAlign: "center" },
  compactFooterButton: { borderRadius: 12 },
  compactFooterText: { lineHeight: 20, includeFontPadding: false }
});
