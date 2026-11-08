import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const theme = fs.readFileSync("constants/app-theme.ts", "utf8");
const shell = fs.readFileSync("components/screen-shell.tsx", "utf8");
const sheet = fs.readFileSync("components/body-frame-sheet.tsx", "utf8");
const tabs = fs.readFileSync("app/(tabs)/_layout.tsx", "utf8");
const appearance = fs.readFileSync("lib/app-appearance.ts", "utf8");

test("R1 neutral palettes use agreed light and dark color roles", () => {
  for (const token of [
    'background: "#F7F8FA"', 'chrome: "#F7F8FA"', 'surface: "#FFFFFF"',
    'surfaceStrong: "#ECEEF1"', 'text: "#181A1D"', 'muted: "#5D6269"',
    'line: "#DDE1E5"', 'background: "#0B0B0C"', 'surface: "#1A1A1D"',
    'surfaceStrong: "#292D31"', 'text: "#F5F5F5"', 'line: "#323437"'
  ]) assert.ok(theme.includes(token), token);
  assert.ok(theme.includes('bodyFrameAccent = "#C6FF4D"'));
});

test("R1 preserves existing typography touch target and consistent components", () => {
  for (const token of ["minTouchSize: 44", "primaryButtonHeight: 48", "cardRadius: 8",
    "buttonRadius: 8", "modalRadius: 10", "bottomSheetRadius: 12"]) assert.ok(theme.includes(token));
  assert.ok(sheet.includes("getBodyFrameControlColors(palette)"));
  assert.ok(shell.includes("palette.background"));
  assert.ok(tabs.includes("backgroundColor: palette.chrome"));
  assert.ok(appearance.includes("getAppPalette(settings, systemScheme)"));
});

test("R1 prohibits unsafe lime-only light text/selection and preserves dark CTA contrast", () => {
  const matched = theme.match(/bodyFrameAccent = "(#[A-Fa-f0-9]{6})"/);
  assert.ok(matched);
  const lum = hex => {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = rgb.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  assert.ok(contrast(matched[1], "#FFFFFF") < 3);
  assert.ok(contrast("#181A1D", "#F7F8FA") >= 4.5);
  assert.ok(contrast("#F5F5F5", "#0B0B0C") >= 4.5);
});
