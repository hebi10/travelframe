import { StyleSheet } from "react-native";

import { bodyFrameDarkColors, bodyFrameDesign, bodyFrameTypography, colors, controls, typography } from "@/constants/app-theme";
import {
  CAMERA_CONTROL_TRAY_HORIZONTAL_PADDING,
  CAMERA_FOCUS_INDICATOR_RADIUS,
  CAMERA_FOCUS_INDICATOR_SIZE,
  CAMERA_FOCUS_LOCK_BUTTON_SIZE,
  EXPOSURE_CONTROL_GAP,
  EXPOSURE_CONTROL_HEIGHT,
  EXPOSURE_CONTROL_WIDTH,
  EXPOSURE_TRACK_WIDTH
} from "@/features/camera/camera-screen.constants";

const CAMERA_CONTROL_HORIZONTAL_PADDING = 0;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink
  },
  cameraPreviewViewport: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  cameraPreviewFrame: {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.ink
  },
  cameraPreviewFrameFill: {
    top: 0,
    bottom: 0
  },
  camera: {
    ...StyleSheet.absoluteFillObject
  },
  poseAlignmentBanner: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 12,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "rgba(255, 255, 255, 0.34)",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "rgba(11, 11, 12, 0.82)",
    zIndex: 10
  },
  poseAlignmentBannerAligned: {
    borderColor: "rgba(255, 255, 255, 0.72)"
  },
  poseAlignmentText: {
    color: colors.inverse,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0
  },
  cameraColorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2
  },
  guidePositionLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3
  },
  guidePositionDragLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 16,
    backgroundColor: "transparent"
  },
  cameraSwipeLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 4,
    backgroundColor: "transparent"
  },
  focusIndicator: {
    position: "absolute",
    width: CAMERA_FOCUS_INDICATOR_SIZE,
    height: CAMERA_FOCUS_INDICATOR_SIZE,
    borderRadius: CAMERA_FOCUS_INDICATOR_RADIUS,
    borderWidth: 2,
    borderColor: colors.inverse,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    zIndex: 12
  },
  focusLockButtonWrap: {
    position: "absolute",
    width: CAMERA_FOCUS_LOCK_BUTTON_SIZE,
    height: CAMERA_FOCUS_LOCK_BUTTON_SIZE,
    zIndex: 19
  },
  focusLockButton: {
    width: CAMERA_FOCUS_LOCK_BUTTON_SIZE,
    height: CAMERA_FOCUS_LOCK_BUTTON_SIZE,
    borderRadius: CAMERA_FOCUS_LOCK_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  },
  focusLockButtonActive: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "#E53935"
  },
  focusLockButtonPressed: {
    opacity: 0.78
  },
  exposureTapControl: {
    position: "absolute",
    width: EXPOSURE_CONTROL_WIDTH,
    height: EXPOSURE_CONTROL_HEIGHT,
    zIndex: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  exposureControl: {
    width: "100%",
    height: EXPOSURE_CONTROL_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: EXPOSURE_CONTROL_GAP,
    justifyContent: "center"
  },
  exposureTrack: {
    width: EXPOSURE_TRACK_WIDTH,
    justifyContent: "center"
  },
  exposureTrackLine: {
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.45)"
  },
  exposureCenterMark: {
    position: "absolute",
    left: "50%",
    width: 2,
    height: 14,
    backgroundColor: "rgba(255, 255, 255, 0.7)"
  },
  exposureThumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.inverse,
    backgroundColor: colors.background
  },
  exposureThumbHidden: {
    opacity: 0
  },
  topBar: {
    position: "absolute",
    left: bodyFrameDesign.horizontalPadding,
    right: bodyFrameDesign.horizontalPadding,
    top: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cameraHeaderButton: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "rgba(255, 255, 255, 0.42)",
    backgroundColor: "rgba(0, 0, 0, 0.34)"
  },
  cameraHeaderCenter: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 10
  },
  countdownOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    pointerEvents: "none"
  },
  countdownText: {
    color: colors.inverse,
    fontSize: 72,
    fontWeight: "800",
    lineHeight: 82,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 12,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: CAMERA_CONTROL_HORIZONTAL_PADDING,
    paddingTop: 10,
    backgroundColor: "transparent"
  },
  overlayPanel: {
    width: "100%",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: "rgba(0, 0, 0, 0.36)"
  },
  overlayPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  overlayTitle: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  overlayValue: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  overlayActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  overlayButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    minWidth: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.42)"
  },
  overlayButtonActive: {
    borderColor: colors.inverse,
    backgroundColor: "transparent"
  },
  overlayButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  overlayButtonTextActive: {
    color: colors.inverse
  },
  overlaySetupPanel: {
    width: "100%",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    backgroundColor: "rgba(0, 0, 0, 0.42)"
  },
  overlaySetupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  overlaySetupTitle: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  overlaySetupHint: {
    color: "rgba(255, 255, 255, 0.64)",
    fontSize: bodyFrameTypography.caption,
    lineHeight: 16,
    letterSpacing: 0
  },
  overlaySetupValue: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  overlaySetupActions: {
    flexDirection: "row",
    gap: 8
  },
  overlayOpacityControl: {
    paddingTop: 2
  },
  overlayCompactButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.42)"
  },
  overlayRemoveButton: {
    borderColor: "rgba(255, 90, 95, 0.8)"
  },
  overlayCompactText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  overlayRemoveText: {
    color: "#FFB3B6"
  },
  overlayConfirmButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.inverse,
    backgroundColor: "transparent"
  },
  overlayConfirmText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 14,
    backgroundColor: "transparent"
  },
  modalGestureRoot: {
    flex: 1
  },
  navModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 14,
    backgroundColor: "rgba(0, 0, 0, 0.16)"
  },
  guideModal: {
    gap: 16,
    flexGrow: 0,
    maxHeight: "88%",
    padding: 18,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: colors.darkLine,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    overflow: "hidden"
  },
  navModal: {
    gap: 18,
    flexGrow: 0,
    maxHeight: "88%",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: bodyFrameDarkColors.line,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#101012",
    overflow: "hidden"
  },
  cameraSettingsHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    marginBottom: 2,
    borderRadius: 2,
    backgroundColor: "#55555B"
  },
  cameraSettingsHeader: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingTop: 6
  },
  cameraSettingsEyebrow: {
    color: bodyFrameDarkColors.muted,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "700",
    letterSpacing: 0.4
  },
  cameraSettingsTitle: {
    color: bodyFrameDarkColors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  cameraSettingsCloseButton: {
    minWidth: 64,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#3A3A40",
    borderRadius: bodyFrameDesign.modalRadius,
    backgroundColor: "#171719"
  },
  cameraSettingsCloseText: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
    letterSpacing: 0
  },
  cameraSettingsScrollShell: {
    position: "relative",
    flexShrink: 1,
    minHeight: 0
  },
  cameraSettingsScrollHint: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  cameraSettingsScrollHintText: {
    color: colors.muted,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  cameraSettingsScrollHintIcon: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
    letterSpacing: 0
  },
  cameraSettingsScroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 560
  },
  cameraSettingsContent: {
    gap: 22,
    paddingBottom: 28
  },
  cameraToolIntro: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#35353A",
    borderRadius: bodyFrameDesign.modalRadius,
    backgroundColor: "#151517"
  },
  cameraToolIntroCopy: {
    flex: 1,
    gap: 5
  },
  cameraSettingsSectionTitle: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  cameraSettingsSectionDetail: {
    color: bodyFrameDarkColors.muted,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    letterSpacing: 0
  },
  cameraSettingsDivider: {
    height: bodyFrameDesign.borderWidth,
    backgroundColor: bodyFrameDarkColors.line
  },
  cameraSettingsOptionRow: {
    flexDirection: "row",
    gap: 8
  },
  cameraSettingsOptionButton: {
    minHeight: 52,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#35353A",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "#18181B"
  },
  cameraSettingsOptionButtonActive: {
    borderColor: "#505058",
    backgroundColor: "#050506"
  },
  cameraSettingsOptionButtonText: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
    letterSpacing: 0
  },
  cameraSettingsOptionButtonTextActive: {
    color: bodyFrameDarkColors.text
  },
  guideSettingsScroll: {
    flexGrow: 0
  },
  guideSettingsContent: {
    gap: 16,
    paddingBottom: 2
  },
  cameraToolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  cameraToolButton: {
    width: "31%",
    minWidth: 88,
    minHeight: 96,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "#35353A",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "#18181B"
  },
  cameraToolButtonActive: {
    borderColor: "#5A5A62",
    backgroundColor: "#0A0A0C"
  },
  cameraToolText: {
    color: bodyFrameDarkColors.text,
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
    letterSpacing: 0
  },
  cameraSettingBlock: {
    gap: 10
  },
  settingToggleRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  settingToggleRowDisabled: {
    opacity: 0.45
  },
  cameraSettingsToggleRow: {
    borderColor: "#35353A",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "#18181B"
  },
  cameraSettingsToggleTitle: {
    color: bodyFrameDarkColors.text
  },
  cameraSettingsToggleDetail: {
    color: bodyFrameDarkColors.muted
  },
  cameraSettingsToggleValue: {
    color: bodyFrameDarkColors.text
  },
  settingToggleCopy: {
    flex: 1,
    gap: 4
  },
  settingToggleTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  settingToggleDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  settingToggleValue: {
    minWidth: 42,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0
  },
  shutterSoundPanel: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  cameraSettingsShutterPanel: {
    borderColor: "#35353A",
    borderRadius: bodyFrameDesign.buttonRadius,
    backgroundColor: "#18181B"
  },
  shutterSoundHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  shutterSoundIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  cameraSettingsShutterIcon: {
    borderColor: "#35353A",
    backgroundColor: "#111113"
  },
  shutterSoundCopy: {
    flex: 1,
    gap: 4
  },
  shutterSoundDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  shutterSoundOptions: {
    flexDirection: "row",
    gap: 8
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  modalTitleGroup: {
    gap: 4
  },
  modalEyebrow: {
    color: colors.faint,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: 0
  },
  modalCloseButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  modalCloseText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  modalSection: {
    gap: 10
  },
  modalSectionSpaced: {
    paddingTop: 8
  },
  modalSectionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  modalSectionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionRow: {
    flexDirection: "row",
    gap: 8
  },
  optionButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  optionButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  optionButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  optionButtonTextActive: {
    color: colors.inverse
  },
  sizeFineControl: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 2
  },
  sizeSliderArea: {
    flex: 1,
    gap: 9
  },
  compactSliderArea: {
    width: "100%",
    flex: 0
  },
  compactSliderRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  compactSliderLabel: {
    minWidth: 48,
    color: colors.muted,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "800",
    letterSpacing: 0
  },
  compactSliderValue: {
    minWidth: 30,
    color: colors.text,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  sizeSliderMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  sizeSliderMetaText: {
    color: colors.muted,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "800",
    letterSpacing: 0
  },
  sizeTrack: {
    height: 28,
    justifyContent: "center"
  },
  compactSizeTrack: {
    flex: 1
  },
  sizeTrackFill: {
    position: "absolute",
    left: 0,
    height: 2,
    backgroundColor: colors.text
  },
  sizeTrackFillBase: {
    height: 2,
    backgroundColor: colors.line
  },
  sizeThumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  sizeInput: {
    width: 58,
    minHeight: controls.height,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.text,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    textAlign: "center"
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    gap: 4
  },
  colorOption: {
    minHeight: 44,
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.line
  },
  colorOptionActive: {
    borderColor: colors.text
  },
  colorSwatch: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: colors.darkLine
  },
  colorLabel: {
    color: colors.text,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "800",
    letterSpacing: 0
  },
  visibilityButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  visibilityButtonActive: {
    backgroundColor: colors.text
  },
  visibilityButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  visibilityButtonTextActive: {
    color: colors.inverse
  },
  guidePositionButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  guidePositionButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guidePositionActionGroup: {
    position: "absolute",
    zIndex: 30,
    flexDirection: "row",
    gap: 8
  },
  guidePositionSecondaryButton: {
    minWidth: 76,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.72)",
    backgroundColor: "rgba(0, 0, 0, 0.42)"
  },
  guidePositionSecondaryText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guidePositionDoneButton: {
    minWidth: 88,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.inverse,
    backgroundColor: "rgba(0, 0, 0, 0.58)"
  },
  guidePositionDoneText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  navList: {
    gap: 8
  },
  navItem: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  navItemCopy: {
    flex: 1,
    gap: 3
  },
  navItemTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  navItemDetail: {
    color: colors.muted,
    fontSize: typography.small,
    letterSpacing: 0
  },
  navItemArrow: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  cameraControlDeck: {
    width: "100%",
    gap: 0
  },
  cameraFloatingPanelWrap: {
    width: "100%",
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  cameraFloatingPanelRaised: {
    zIndex: 22,
    marginBottom: 10
  },
  cameraControlPanelViewport: {
    width: "100%",
    minHeight: 42,
    overflow: "hidden"
  },
  cameraControlPage: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  cameraColorPanel: {
    width: "100%",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  cameraColorHeaderRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  cameraColorHeader: {
    flex: 1,
    gap: 3
  },
  cameraColorTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
    letterSpacing: 0
  },
  cameraColorHint: {
    color: colors.muted,
    fontSize: bodyFrameTypography.caption,
    lineHeight: 16,
    letterSpacing: 0
  },
  cameraColorCloseButton: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  cameraColorSlotRow: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    gap: 7
  },
  cameraColorSlotButton: {
    flex: 1,
    minWidth: 0,
    height: bodyFrameDesign.minTouchSize,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  cameraColorSlotButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  cameraColorSlotButtonSaved: {
    borderColor: colors.text
  },
  cameraColorSlotSavedDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text
  },
  cameraColorSlotText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  cameraColorSlotTextMuted: {
    color: colors.muted
  },
  cameraColorSliderList: {
    gap: 10
  },
  cameraColorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  quickButtonRow: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  quickPillButton: {
    minWidth: 48,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.36)",
    backgroundColor: "rgba(0, 0, 0, 0.28)"
  },
  quickPillButtonActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.inverse
  },
  quickPillText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  quickPillTextActive: {
    color: colors.text
  },
  cameraControlBottomTray: {
    width: "100%",
    gap: 30,
    paddingTop: 10,
    paddingHorizontal: CAMERA_CONTROL_HORIZONTAL_PADDING,
    backgroundColor: "rgba(0, 0, 0, 0.4)"
  },
  captureRow: {
    width: "100%",
    minHeight: 66,
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  galleryButton: {
    position: "absolute",
    left: CAMERA_CONTROL_TRAY_HORIZONTAL_PADDING,
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    backgroundColor: "rgba(0, 0, 0, 0.38)"
  },
  overlayQuickButton: {
    position: "absolute",
    right: CAMERA_CONTROL_TRAY_HORIZONTAL_PADDING,
    width: 76,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: bodyFrameDesign.borderWidth,
    borderColor: "rgba(255, 255, 255, 0.62)",
    backgroundColor: "rgba(0, 0, 0, 0.38)"
  },
  overlayQuickButtonDisabled: {
    opacity: 0.42
  },
  overlayQuickValue: {
    color: colors.inverse,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  overlayQuickLabel: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: bodyFrameTypography.caption,
    fontWeight: "700",
    letterSpacing: 0
  },
  galleryThumb: {
    width: "100%",
    height: "100%"
  },
  galleryEmptyThumb: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  gallerySavingOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: "rgba(0, 0, 0, 0.68)"
  },
  gallerySavingText: {
    color: colors.inverse,
    textAlign: "center",
    fontSize: bodyFrameTypography.caption,
    fontWeight: "900",
    letterSpacing: 0
  },
  opacityStepButton: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center"
  },
  opacityStepText: {
    color: colors.inverse,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  opacityValue: {
    minWidth: 42,
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  shutterOuter: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.inverse
  },
  shutterDisabled: {
    opacity: 0.45
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.inverse
  },
  errorText: {
    color: colors.inverse,
    fontSize: typography.small,
    lineHeight: 17,
    textAlign: "center",
    letterSpacing: 0
  },
  permissionScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: colors.background
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    textAlign: "center",
    letterSpacing: 0
  },
  permissionText: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0
  },
  permissionButton: {
    minHeight: controls.height,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: colors.text
  },
  permissionSecondaryButton: {
    backgroundColor: colors.background,
    borderWidth: controls.borderWidth,
    borderColor: colors.line
  },
  permissionButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  permissionSecondaryButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  }
});
