import { StyleSheet } from "react-native";

import { colors, controls, typography } from "@/constants/app-theme";

export const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  tab: {
    flexGrow: 1,
    minWidth: 96,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    backgroundColor: colors.background
  },
  tabActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  tabText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  tabTextActive: {
    color: colors.inverse
  },
  pageSizeBar: {
    minHeight: controls.compactHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 2
  },
  pageSizeLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  pageSizeOptions: {
    flexDirection: "row",
    gap: 0
  },
  pageSizeButton: {
    minWidth: 58,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  pageSizeButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  pageSizeButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  pageSizeButtonTextActive: {
    color: colors.inverse
  },
  clipCta: {
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  importImageCta: {
    minHeight: 184,
    alignItems: "center",
    gap: 14,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  disabledAction: {
    opacity: 0.45
  },
  clipCopy: {
    gap: 8
  },
  importImageCopy: {
    alignItems: "center"
  },
  clipTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  importImageTitle: {
    fontSize: typography.section,
    lineHeight: 22,
    textAlign: "center"
  },
  clipDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  importImageDetail: {
    maxWidth: 300,
    textAlign: "center"
  },
  clipAction: {
    minHeight: 40,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.text
  },
  clipActionText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    lineHeight: 19,
    textAlign: "center",
    letterSpacing: 0
  },
  importIconWrap: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  studioIconBox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 2
  },
  studioIconDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    marginTop: 3,
    marginLeft: 3
  },
  studioIconBase: {
    width: 10,
    height: 2,
    marginTop: 5,
    marginLeft: 3
  },
  studioIconPlay: {
    width: 0,
    height: 0,
    marginTop: 3,
    marginLeft: 5,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 6,
    borderTopColor: "transparent",
    borderBottomColor: "transparent"
  },
  studioFolderIcon: {
    width: 20,
    height: 18,
    justifyContent: "flex-end"
  },
  studioFolderTab: {
    width: 8,
    height: 3,
    marginLeft: 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2
  },
  studioFolderBody: {
    width: 20,
    height: 14,
    borderWidth: 2,
    borderRadius: 2
  },
  studioUploadIcon: {
    width: 26,
    height: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  studioUploadStem: {
    width: 3,
    height: 16
  },
  studioUploadHead: {
    position: "absolute",
    top: 3,
    width: 11,
    height: 11,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    transform: [{ rotate: "45deg" }]
  },
  importProgressBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "rgba(0, 0, 0, 0.38)"
  },
  importProgressPanel: {
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  importProgressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  importProgressCopy: {
    flex: 1,
    gap: 6
  },
  importProgressTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
    letterSpacing: 0
  },
  importProgressDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  importProgressTrack: {
    height: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(0, 0, 0, 0.08)"
  },
  importProgressFill: {
    height: "100%",
    backgroundColor: colors.text
  },
  importProgressText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    textAlign: "right",
    letterSpacing: 0
  },
  loading: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center"
  },
  paginatedList: {
    gap: 12
  },
  backupUsageBadge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  backupUsageText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  photoGrid: {
    paddingTop: 4
  },
  photoGridRow: {
    justifyContent: "space-between"
  },
  photoGridRowGap: {
    height: 14
  },
  photoGridItem: {
    width: "48%",
    flexShrink: 0
  },
  photoCard: {
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.background
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  photoMeta: {
    gap: 4
  },
  photoDate: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  metaText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  cardActions: {
    flexDirection: "row",
    gap: 6
  },
  cardButton: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  cardButtonText: {
    color: colors.inverse,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  cardLightButton: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  cardLightButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  cardDeleteButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  videoList: {
    gap: 10
  },
  paginationBar: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  paginationButton: {
    minHeight: 32,
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  paginationButtonDisabled: {
    opacity: 0.35
  },
  paginationButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  paginationMeta: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    textAlign: "center",
    letterSpacing: 0
  },
  videoCard: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  videoThumb: {
    width: 72,
    height: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  videoThumbEmpty: {
    width: 72,
    height: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink
  },
  videoCopy: {
    flex: 1,
    gap: 5
  },
  videoKind: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  videoTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  workActions: {
    width: 72,
    gap: 6
  },
  workEditButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  workEditButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  workDeleteButton: {
    minWidth: 42,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  workDeleteButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  libraryErrorState: {
    minHeight: 96,
    gap: 10,
    alignItems: "flex-start",
    paddingTop: 2,
    paddingBottom: 10
  },
  retryButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  retryButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  emptyState: {
    minHeight: 72,
    gap: 6,
    paddingTop: 2,
    paddingBottom: 10
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  emptyDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  }
});
