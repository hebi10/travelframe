import { StyleSheet } from "react-native";

import { colors, controls, spacing, typography } from "@/constants/app-theme";
import { RECORDING_VIEW_WIDTH } from "@/features/trip-clip/trip-clip-screen.constants";

export const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: colors.background
  },
  recordingHost: {
    position: "absolute",
    top: 0,
    left: -10000,
    width: RECORDING_VIEW_WIDTH,
    zIndex: -1
  },
  recordingView: {
    overflow: "hidden",
    backgroundColor: colors.ink
  },
  recordingCanvasInner: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.ink
  },
  recordingCanvasFilm: {
    padding: 22
  },
  recordingLayer: {
    ...StyleSheet.absoluteFillObject
  },
  recordingNextLayer: {
    zIndex: 2
  },
  recordingImage: {},
  recordingImageMotionLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  recordingImageFilm: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)"
  },
  recordingFilmMeta: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  recordingFilmText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  recordingCenterGuide: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    pointerEvents: "none"
  },
  recordingWatermark: {
    position: "absolute",
    right: 18,
    bottom: 18,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0, 0, 0, 0.52)"
  },
  recordingWatermarkText: {
    color: colors.inverse,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    gap: spacing.section,
    padding: spacing.screen,
    paddingBottom: spacing.section
  },
  header: {
    gap: 10,
    paddingTop: 6
  },
  headerActionRow: {
    minHeight: controls.compactHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  headerBackButton: {
    minHeight: controls.compactHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingRight: 10
  },
  headerBackButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  headerSpacer: {
    flex: 1
  },
  draftSaveButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  draftSaveButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    lineHeight: 35,
    letterSpacing: 0
  },
  description: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
    letterSpacing: 0
  },
  draftPanel: {
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.surface
  },
  draftCopy: {
    gap: 4
  },
  draftTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  draftDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  draftActions: {
    flexDirection: "row",
    gap: 8
  },
  draftButton: {
    flex: 1,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  draftButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  draftGhostButton: {
    minWidth: 72,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  draftGhostButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  workTitlePanel: {
    gap: 8,
    paddingTop: 4
  },
  workTitleInput: {
    minHeight: controls.height,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0,
    backgroundColor: colors.background
  },
  previewSection: {
    gap: 12
  },
  previewFrame: {
    width: "100%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.ink,
    position: "relative"
  },
  previewGuideMoveLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 11,
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 10,
    backgroundColor: "rgba(17, 17, 17, 0.08)"
  },
  previewGuideMoveText: {
    color: colors.inverse,
    fontSize: typography.small,
    fontWeight: "800",
    lineHeight: 17,
    letterSpacing: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(17, 17, 17, 0.74)"
  },
  previewAdjustButton: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 10,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(17, 17, 17, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.88)"
  },
  previewAdjustButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  previewAdjustButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  previewAdjustButtonTextActive: {
    color: colors.inverse
  },
  frameFitInlineActions: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 10,
    flexDirection: "row",
    gap: 8
  },
  frameFitInlineButton: {
    minHeight: 34,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(17, 17, 17, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.9)"
  },
  frameFitInlinePrimaryButton: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  frameFitInlineButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  frameFitInlinePrimaryButtonText: {
    color: colors.inverse
  },
  previewInner: {
    flex: 1,
    backgroundColor: colors.ink,
    position: "relative"
  },
  previewInnerFilm: {
    padding: 22
  },
  previewImage: {
    width: "100%",
    height: "100%"
  },
  previewGestureLayer: {
    flex: 1
  },
  previewPreviousLayer: {
    ...StyleSheet.absoluteFillObject
  },
  previewImageMotionLayer: {
    flex: 1
  },
  previewImageFilm: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)"
  },
  emptyPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24
  },
  emptyPreviewPressed: {
    backgroundColor: "#161616"
  },
  emptyPreviewText: {
    color: colors.inverse,
    fontSize: typography.section,
    fontWeight: "800",
    maxWidth: "86%",
    minHeight: 68,
    lineHeight: 34,
    textAlign: "center",
    includeFontPadding: true,
    letterSpacing: 0
  },
  previewMeta: {
    gap: 4
  },
  previewTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  previewDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  durationWarningText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    lineHeight: 18,
    letterSpacing: 0
  },
  previewActions: {
    flexDirection: "row",
    gap: 10
  },
  frameFitModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 14,
    backgroundColor: "rgba(17, 17, 17, 0.72)"
  },
  frameFitModalPanel: {
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  frameFitModalHeader: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  frameFitModalCopy: {
    flex: 1,
    gap: 4
  },
  frameFitModalTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
    letterSpacing: 0
  },
  frameFitModalDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  frameFitModalCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  frameFitModalFrame: {
    width: "100%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.ink
  },
  frameFitModalActions: {
    minHeight: 40,
    flexDirection: "row",
    gap: 10
  },
  frameFitModalButton: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  frameFitModalPrimaryButton: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  frameFitModalButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  frameFitModalPrimaryButtonText: {
    color: colors.inverse
  },
  playbackPanel: {
    gap: 10,
    paddingTop: 2
  },
  playbackTopRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  playbackSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  playbackSideRight: {
    justifyContent: "flex-end"
  },
  playToggleButton: {
    minWidth: 56,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  playToggleText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  timeText: {
    width: 92,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  restartButton: {
    minWidth: 48,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  restartButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  scrubber: {
    height: 32,
    justifyContent: "center"
  },
  scrubberBase: {
    height: 2,
    backgroundColor: colors.line
  },
  scrubberFill: {
    position: "absolute",
    left: 0,
    height: 2,
    backgroundColor: colors.text
  },
  scrubberThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  primaryButton: {
    flex: 1,
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
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
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
  section: {
    gap: 12
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  loading: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center"
  },
  photoPicker: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 8
  },
  emptyPhotoPicker: {
    gap: 12
  },
  photoTile: {
    width: 124,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  photoTileActive: {
    borderColor: colors.text
  },
  addPhotoTile: {
    minHeight: 176,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    backgroundColor: colors.background
  },
  addPhotoIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  addPhotoIconText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: 0
  },
  addPhotoTitle: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  addPhotoDetail: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  photoThumb: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.surface
  },
  photoTileMeta: {
    gap: 3,
    minHeight: 54,
    padding: 8
  },
  photoTileText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  photoTileDetail: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  orderBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  orderBadgeText: {
    color: colors.inverse,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  removePhotoButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  removePhotoButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 14,
    letterSpacing: 0
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  },
  timeline: {
    gap: 10
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  timelineThumb: {
    width: 48,
    height: 60,
    backgroundColor: colors.surface
  },
  timelineCopy: {
    flex: 1,
    gap: 4
  },
  timelineTitle: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  timelineDetail: {
    color: colors.muted,
    fontSize: typography.small,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  timelineDurationDetailEditing: {
    color: colors.text,
    fontWeight: "900"
  },
  timelineDurationInput: {
    width: 64,
    minHeight: 30,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.text,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
    fontVariant: ["tabular-nums"]
  },
  timelineDurationKeyboardPanel: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 40,
    elevation: 8,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  timelineDurationKeyboardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  timelineDurationKeyboardTitle: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  timelineDurationKeyboardDetail: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0
  },
  timelineDurationKeyboardInput: {
    width: 76,
    minHeight: 38,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.text,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: typography.body,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
    fontVariant: ["tabular-nums"]
  },
  timelineDurationKeyboardDoneButton: {
    minWidth: 58,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: colors.text
  },
  timelineDurationKeyboardDoneText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  smallControls: {
    gap: 6,
    width: 134
  },
  controlLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6
  },
  controlLabel: {
    minWidth: 28,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  smallButton: {
    minWidth: 34,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  settingDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  settingLabel: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideSummaryPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  guideSummaryCopy: {
    flex: 1,
    gap: 5
  },
  guideSummaryValue: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideToggleButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  guideToggleButtonActive: {
    backgroundColor: colors.text
  },
  guideToggleButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideToggleButtonTextActive: {
    color: colors.inverse
  },
  guideMoveActions: {
    flexDirection: "row",
    gap: 8
  },
  guideMoveButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  guideMoveButtonActive: {
    backgroundColor: colors.text
  },
  guideMoveButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideMoveButtonTextActive: {
    color: colors.inverse
  },
  guideSizeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  guideSizeInput: {
    width: 64,
    minHeight: controls.height,
    borderWidth: 1,
    borderColor: colors.text,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0
  },
  guideColorRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    gap: 4
  },
  guideColorOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guideColorOptionActive: {
    borderColor: colors.text
  },
  guideColorSwatch: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.darkLine
  },
  guideColorLabel: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0
  },
  chip: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  chipActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  chipText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  chipTextActive: {
    color: colors.inverse
  },
  musicList: {
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  musicModeRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12
  },
  musicUserPanel: {
    gap: 8
  },
  musicRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  musicRowActive: {
    borderColor: colors.text,
    backgroundColor: colors.surface
  },
  musicAddRow: {
    borderStyle: "dashed"
  },
  musicComingSoonCard: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  musicComingSoonModes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  musicComingSoonMode: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  musicComingSoonModeText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  musicCopy: {
    flex: 1,
    gap: 4,
    paddingLeft: 8
  },
  musicTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  musicDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  musicMark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text
  },
  musicPickButton: {
    minWidth: 58,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  musicPickButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  volumeControls: {
    minHeight: controls.height,
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  volumeActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  volumeText: {
    minWidth: 42,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
    fontVariant: ["tabular-nums"]
  },
  filmMeta: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  filmText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  centerGuide: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    pointerEvents: "none"
  },
  exportPanel: {
    gap: 10,
    paddingTop: 2
  },
  exportDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  },
  exportFormatList: {
    gap: 8
  },
  exportFormatOption: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  exportFormatOptionActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  exportFormatCopy: {
    flex: 1,
    gap: 4
  },
  exportFormatTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  exportFormatTitleActive: {
    color: colors.inverse
  },
  exportFormatDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  exportFormatDetailActive: {
    color: "rgba(255, 255, 255, 0.74)"
  },
  exportFormatMark: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.faint,
    borderRadius: 999
  },
  exportFormatMarkActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.inverse
  },
  videoBackupOption: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  videoBackupOptionDisabled: {
    opacity: 0.58
  },
  videoBackupCheckbox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  videoBackupCheckboxActive: {
    backgroundColor: colors.text
  },
  videoBackupCheckboxText: {
    color: colors.inverse,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 16,
    letterSpacing: 0
  },
  videoBackupCopy: {
    flex: 1,
    gap: 4
  },
  videoBackupTitle: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  videoBackupDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  imageFormatPanel: {
    gap: 8,
    paddingVertical: 4
  },
  imageFormatOptions: {
    flexDirection: "row",
    gap: 8
  },
  imageFormatButton: {
    flex: 1,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  imageFormatButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  imageFormatButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  imageFormatButtonTextActive: {
    color: colors.inverse
  },
  serverInputRow: {
    flexDirection: "row",
    gap: 8
  },
  serverPreset: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  serverPresetActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  serverPresetText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  serverPresetTextActive: {
    color: colors.inverse
  },
  serverUrlText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    lineHeight: 17,
    letterSpacing: 0
  },
  serverInput: {
    minHeight: controls.height,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: typography.small,
    letterSpacing: 0
  },
  exportMessage: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  exportNotice: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  exportModalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
    backgroundColor: "rgba(0, 0, 0, 0.36)"
  },
  exportModalPanel: {
    width: "92%",
    maxWidth: 360,
    flexGrow: 0,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  exportModalScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0
  },
  exportModalContent: {
    gap: 12,
    padding: 18
  },
  exportModalPanelError: {
    gap: 12,
    borderColor: colors.darkLine
  },
  comingSoonPanel: {
    maxWidth: 340
  },
  exportModalTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 26,
    letterSpacing: 0
  },
  exportModalDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  },
  exportErrorBox: {
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  exportErrorLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0
  },
  exportErrorText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  exportProgressTrack: {
    height: 8,
    overflow: "hidden",
    backgroundColor: colors.surfaceStrong
  },
  exportProgressFill: {
    height: "100%",
    backgroundColor: colors.text
  },
  exportProgressText: {
    alignSelf: "flex-end",
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  exportModalStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2
  },
  exportModalStatusText: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  exportModalActions: {
    gap: 8,
    width: "100%",
    paddingTop: 2,
    paddingBottom: 0
  },
  exportModalExternalActions: {
    paddingHorizontal: 18,
    paddingBottom: 18
  },
  exportModalButton: {
    flex: 0,
    width: "100%"
  },
  bottomEditorTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.background
  },
  bottomEditorTab: {
    width: "31.8%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  bottomEditorTabActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  bottomEditorTabDisabled: {
    opacity: 0.34
  },
  bottomEditorTabText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  bottomEditorTabTextActive: {
    color: colors.inverse
  }
});
