export const colors = {
  background: "#F7F8FA",
  chrome: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceStrong: "#ECEEF1",
  text: "#181A1D",
  muted: "#5D6269",
  faint: "#5D6269",
  line: "#DDE1E5",
  darkLine: "#3D454E",
  inverse: "#FFFFFF",
  ink: "#181A1D"
} as const;

export const spacing = {
  screen: 22,
  section: 28,
  row: 14,
  tight: 8
} as const;

export const typography = {
  eyebrow: 11,
  body: 14,
  small: 12,
  title: 30,
  section: 16,
  button: 12
} as const;

export const controls = {
  height: 44,
  compactHeight: 36,
  borderWidth: 1
} as const;


export const bodyFrameAccent = "#C6FF4D" as const;

export const bodyFrameStatusColors = {
  success: bodyFrameAccent,
  warning: "#F59E0B",
  error: "#EF4444"
} as const;

export const bodyFrameDarkColors = {
  background: "#0B0B0C",
  chrome: "#0B0B0C",
  surface: "#1A1A1D",
  surfaceStrong: "#292D31",
  text: "#F5F5F5",
  muted: "#A0A0A6",
  faint: "#88888F",
  line: "#323437",
  darkLine: "#D5D9DE",
  inverse: "#111111",
  ink: "#F5F5F5"
} as const;

export const getBodyFrameControlColors = (palette: {
  text: string;
  inverse: string;
  surface: string;
  line: string;
  faint: string;
}) => ({
  primaryBackground: palette.text,
  primaryText: palette.inverse,
  secondaryBackground: palette.surface,
  secondaryText: palette.text,
  secondaryBorder: palette.line,
  selected: palette.text,
  unselected: palette.faint
});

export const bodyFrameDesign = {
  horizontalPadding: 16,
  contentMaxWidth: 750,
  sectionGap: 28,
  controlGap: 10,
  minTouchSize: 44,
  iconSize: 20,
  primaryButtonHeight: 48,
  cardRadius: 8,
  buttonRadius: 8,
  modalRadius: 10,
  bottomSheetRadius: 12,
  borderWidth: 1
} as const;

export const bodyFrameSheetDesign = {
  backdropColor: "rgba(0,0,0,0.62)",
  maxHeight: "86%",
  handleWidth: 36,
  handleHeight: 4,
  handleRadius: 2,
  footerGap: 10
} as const;

export const bodyFrameTypography = {
  pageTitle: 26,
  projectTitle: 24,
  sectionTitle: 18,
  metric: 22,
  rowTitle: 14,
  body: 14,
  caption: 12,
  button: 14
} as const;
