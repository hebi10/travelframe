import { StyleSheet } from "react-native";

import { colors, controls, spacing, typography } from "@/constants/app-theme";
import type { AppPalette } from "@/lib/app-appearance";

export const createThemedStyles = (palette: AppPalette, fontFamily?: string) => {
  const isDark = palette.background !== colors.background;
  const fontTextStyle = fontFamily ? { fontFamily } : {};

  return StyleSheet.create({
    panel: {
      borderColor: palette.line,
      backgroundColor: palette.surface
    },
    panelStrong: {
      borderColor: palette.line,
      backgroundColor: palette.surface
    },
    modalPanel: {
      borderTopColor: palette.line,
      backgroundColor: palette.background
    },
    border: {
      borderColor: palette.line
    },
    activeBorder: {
      borderColor: palette.text
    },
    activeFill: {
      borderColor: palette.text,
      backgroundColor: isDark ? palette.surfaceStrong : palette.text
    },
    secondaryButton: {
      borderColor: palette.line,
      backgroundColor: isDark ? palette.surface : palette.background
    },
    colorButton: {
      borderColor: palette.line,
      backgroundColor: palette.background
    },
    input: {
      borderColor: palette.line,
      color: palette.text,
      backgroundColor: palette.surfaceStrong,
      ...fontTextStyle
    },
    text: {
      color: palette.text,
      ...fontTextStyle
    },
    mutedText: {
      color: palette.muted,
      fontWeight: "700",
      ...fontTextStyle
    },
    inverseText: {
      color: isDark ? palette.text : palette.inverse,
      ...fontTextStyle
    },
    inverseMutedText: {
      color: palette.inverse,
      ...fontTextStyle
    },
    optionMark: {
      borderColor: palette.faint,
      backgroundColor: "transparent"
    },
    optionMarkActive: {
      borderColor: palette.text,
      backgroundColor: palette.text
    },
    optionMarkActiveOutline: {
      borderColor: palette.text,
      backgroundColor: "transparent"
    }
  });
};

export const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.42)"
  },
  modalPanel: {
    gap: 18,
    flexGrow: 0,
    maxHeight: "86%",
    padding: spacing.screen,
    paddingBottom: spacing.section,
    borderTopWidth: 1,
    borderTopColor: colors.text,
    backgroundColor: colors.background
  },
  modalScroll: {
    flexGrow: 0
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    letterSpacing: 0
  },
  closeButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  closeButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  optionList: {
    gap: 8
  },
  option: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "transparent"
  },
  optionActive: {
    borderColor: colors.text
  },
  optionCopy: {
    flex: 1,
    gap: 4
  },
  optionLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  optionLabelActive: {
    color: colors.inverse
  },
  optionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  optionDetailActive: {
    color: "rgba(255, 255, 255, 0.74)"
  },
  optionMark: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.faint,
    borderRadius: 999
  },
  optionMarkActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.inverse
  },
  guidePanel: {
    gap: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guidePopupPanel: {
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guidePopupCopy: {
    gap: 5
  },
  guidePopupTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    lineHeight: 21,
    letterSpacing: 0
  },
  guidePopupDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  guidePopupButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  guidePopupButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  guidePanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  guidePanelCopy: {
    flex: 1,
    gap: 5
  },
  guidePanelTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    lineHeight: 21,
    letterSpacing: 0
  },
  guidePanelDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  guideCollapsedRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  guideSummary: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "800",
    lineHeight: 18,
    letterSpacing: 0
  },
  guideExpandButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guideExpandButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  guideVisibleButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guideVisibleButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  guideVisibleButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  guideVisibleButtonTextActive: {
    color: colors.inverse
  },
  compactGroup: {
    gap: 9
  },
  guidePreviewBlock: {
    gap: 9
  },
  guidePreviewFrame: {
    height: 172,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: colors.darkLine,
    backgroundColor: colors.ink
  },
  guidePreviewSky: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "58%",
    backgroundColor: "#26343A"
  },
  guidePreviewGround: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "48%",
    backgroundColor: "#161817"
  },
  guidePreviewSubject: {
    position: "absolute",
    left: "38%",
    bottom: 30,
    width: "24%",
    height: "42%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.38)",
    backgroundColor: "rgba(255, 255, 255, 0.12)"
  },
  guidePreviewDisabled: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.38)"
  },
  guidePreviewDisabledText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  compactGroupTitle: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900",
    letterSpacing: 0
  },
  compactOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  compactOption: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  compactOptionActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  compactOptionText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  compactOptionTextActive: {
    color: colors.inverse
  },
  settingsGuideSizeSlider: {
    gap: 8,
    paddingTop: 2
  },
  settingsGuideSizeSliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  settingsGuideSizeSliderLabel: {
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  settingsGuideSizeSliderValue: {
    minWidth: 34,
    textAlign: "right",
    fontSize: typography.small,
    fontWeight: "900",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  settingsGuideSizeTrack: {
    height: 30,
    justifyContent: "center",
    position: "relative"
  },
  settingsGuideSizeTrackBase: {
    height: 2
  },
  settingsGuideSizeTrackFill: {
    position: "absolute",
    left: 0,
    height: 2
  },
  settingsGuideSizeThumb: {
    position: "absolute",
    width: 18,
    height: 18,
    marginLeft: -9,
    borderWidth: 2
  },
  settingsGuideSizeSliderRange: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  settingsGuideSizeSliderRangeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6
  },
  colorButton: {
    width: "15.8%",
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  colorButtonActive: {
    borderColor: colors.text
  },
  colorSwatch: {
    width: 15,
    height: 15,
    borderWidth: 1,
    borderColor: "transparent"
  },
  colorSwatchLight: {
    borderColor: colors.faint
  },
  colorButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0
  },
  accountPanel: {
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  accountCopy: {
    flex: 1,
    gap: 5
  },
  accountTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    lineHeight: 21,
    letterSpacing: 0
  },
  accountDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  accountBadge: {
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  accountBadgeActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  accountBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0
  },
  accountBadgeTextActive: {
    color: colors.inverse
  },
  accountNotice: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  authForm: {
    gap: 8
  },
  authInput: {
    minHeight: controls.height,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0,
    backgroundColor: colors.background
  },
  authActions: {
    flexDirection: "row",
    gap: 8
  },
  loggedInActions: {
    gap: 10
  },
  backupStatusPanel: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "transparent"
  },
  backupStatusTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
    letterSpacing: 0
  },
  backupStatusDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  backupProgressPanel: {
    gap: 14
  },
  backupProgressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  backupProgressCopy: {
    flex: 1,
    gap: 6
  },
  backupProgressTrack: {
    height: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(0, 0, 0, 0.08)"
  },
  backupProgressFill: {
    height: "100%",
    backgroundColor: colors.text
  },
  backupProgressText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    textAlign: "right",
    letterSpacing: 0
  },
  deleteBackupButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  deleteBackupButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  deleteRequestPrimaryButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  authPrimaryButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  authPrimaryButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  authSecondaryButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  authSecondaryButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  authGoogleButton: {
    flex: 0
  },
  disabledButton: {
    opacity: 0.45
  },
  authMessage: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  }
});
