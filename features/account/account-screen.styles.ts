import { StyleSheet } from "react-native";

import { colors, controls, spacing, typography } from "@/constants/app-theme";
import type { AppPalette } from "@/lib/app-appearance";

export const createAccountThemedStyles = (palette: AppPalette) => {
  const isDark = palette.background !== colors.background;

  return StyleSheet.create({
    panel: {
      borderColor: palette.line,
      backgroundColor: palette.surface
    },
    panelStrong: {
      borderColor: palette.text,
      backgroundColor: palette.surface
    },
    input: {
      borderColor: palette.line,
      color: palette.text,
      backgroundColor: palette.surfaceStrong
    },
    secondaryButton: {
      borderColor: palette.line,
      backgroundColor: palette.background
    },
    activeFill: {
      borderColor: palette.text,
      backgroundColor: isDark ? palette.surfaceStrong : palette.text
    },
    text: {
      color: palette.text
    },
    mutedText: {
      color: palette.muted
    },
    inverseText: {
      color: isDark ? palette.text : palette.inverse
    },
    bottomBorder: {
      borderBottomColor: palette.line
    }
  });
};

export const styles = StyleSheet.create({
  noticePanel: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8
  },
  noticeTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  noticeText: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
    letterSpacing: 0
  },
  segment: {
    flexDirection: "row",
    gap: 8
  },
  segmentButton: {
    minHeight: controls.compactHeight,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  segmentButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  segmentText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  segmentTextActive: {
    color: colors.inverse
  },
  form: {
    gap: 10
  },
  input: {
    minHeight: controls.height,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: typography.body,
    letterSpacing: 0
  },
  primaryButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  primaryButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  secondaryButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  disabledButton: {
    opacity: 0.45
  },
  helpText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  profilePanel: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 14
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.text
  },
  avatarText: {
    color: colors.inverse,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0
  },
  profileCopy: {
    flex: 1,
    gap: 4
  },
  profileName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0
  },
  profileEmail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statusBadge: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  statusBadgeActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  statusBadgeText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  statusBadgeTextActive: {
    color: colors.inverse
  },
  verifyPanel: {
    gap: 10
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8
  },
  infoList: {
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  infoRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  infoLabel: {
    color: colors.muted,
    fontSize: typography.small,
    letterSpacing: 0
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0
  },
  backupSummaryPanel: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
    backgroundColor: colors.background
  },
  planCard: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.text,
    gap: 14,
    backgroundColor: colors.background
  },
  paymentGrid: {
    gap: 10
  },
  paymentPlan: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
    backgroundColor: colors.background
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  planCopy: {
    flex: 1,
    gap: 6
  },
  planTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
    letterSpacing: 0,
    backgroundColor: "transparent"
  },
  planPrice: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    letterSpacing: 0
  },
  benefitList: {
    gap: 8
  },
  benefitText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  paymentOpenButton: {
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center"
  },
  paymentModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
    backgroundColor: "rgba(0, 0, 0, 0.36)"
  },
  paymentModalPanel: {
    gap: 16,
    flexGrow: 0,
    maxHeight: "86%",
    padding: spacing.screen,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  modalCloseButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statCard: {
    width: "48%",
    minHeight: 86,
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  statValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0
  },
  statLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  musicPanel: {
    gap: 12
  },
  musicHeader: {
    minHeight: controls.height,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  musicCount: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    letterSpacing: 0
  },
  musicUploadButton: {
    minWidth: 112
  },
  musicList: {
    gap: 8
  },
  musicItem: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  musicCopy: {
    flex: 1,
    gap: 5
  },
  musicTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
    letterSpacing: 0
  },
  musicDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  musicDeleteButton: {
    minWidth: 64,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  musicDeleteText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  messagePanel: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10
  },
  messageText: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  }
});
