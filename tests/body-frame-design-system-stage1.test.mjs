import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const themeSource = read("constants/app-theme.ts");
const transpiled = ts.transpileModule(themeSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const theme = await import(`data:text/javascript,${encodeURIComponent(transpiled)}`);

const luminance = (hex) => {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

for (const palette of [theme.bodyFrameDarkColors, theme.colors]) {
  const ui = theme.getBodyFrameControlColors(palette);
  assert.equal(ui.primaryBackground, palette.text);
  assert.equal(ui.primaryText, palette.inverse);
  assert.equal(ui.secondaryBackground, palette.surface);
  assert.equal(ui.secondaryBorder, palette.line);
  assert.equal(ui.selected, palette.text);
  assert.equal(ui.unselected, palette.faint);
  assert.ok(contrast(ui.primaryBackground, ui.primaryText) >= 4.5, "primary label must retain text contrast");
  assert.ok(contrast(ui.selected, palette.chrome) >= 4.5, "selected tab must retain contrast");
}
assert.notEqual(theme.bodyFrameStatusColors.success, theme.bodyFrameAccent);
for (const palette of [theme.colors, theme.bodyFrameDarkColors]) {
  const status = theme.getBodyFrameStatusColors(palette);
  for (const key of ["success", "warning", "error"]) {
    assert.ok(contrast(status[key], palette.surface) >= 4.5, key + " status must remain readable on " + palette.surface);
    assert.ok(contrast(status[key], palette.background) >= 4.5, key + " status must remain readable on " + palette.background);
  }
}
assert.equal(theme.bodyFrameDesign.minTouchSize, 44);
assert.equal(theme.bodyFrameDesign.primaryButtonHeight, 48);
assert.equal(theme.bodyFrameDesign.iconSize, 20);
assert.equal(theme.bodyFrameDesign.contentMaxWidth, 750);

const sheet = read("components/body-frame-sheet.tsx");
const tabs = read("app/(tabs)/_layout.tsx");
const glyph = read("components/tab-glyph.tsx");
const guide = read("components/app-guide-card.tsx");
const welcome = read("components/app-guide-overlay.tsx");
const shell = read("components/screen-shell.tsx");
const row = read("components/action-row.tsx");
const section = read("components/section-block.tsx");
const appText = read("components/app-text.tsx");

for (const [name, source] of [
  ["sheet", sheet], ["tabs", tabs], ["glyph", glyph], ["guide", guide], ["welcome", welcome]
]) {
  assert.ok(source.includes("getBodyFrameControlColors(palette)"), name + " must use shared action colors");
  assert.ok(!source.includes("bodyFrameAccent"), name + " must not use success green as default action color");
}
assert.ok(sheet.includes("minHeight: bodyFrameDesign.primaryButtonHeight"));
assert.ok(sheet.includes("minHeight: bodyFrameDesign.minTouchSize") ||
          sheet.includes("width: bodyFrameDesign.minTouchSize"));
assert.ok(glyph.includes("size={bodyFrameDesign.iconSize}"));
assert.ok(tabs.includes("minHeight: bodyFrameDesign.minTouchSize"));
assert.ok(tabs.includes('href: null'), "account route must stay hidden from tabs");
assert.equal((tabs.match(/tabBarIcon:/g) ?? []).length, 4, "existing four tabs must remain");
assert.ok(guide.includes("minHeight: bodyFrameDesign.primaryButtonHeight"));
assert.ok(welcome.includes("minHeight: bodyFrameDesign.primaryButtonHeight"));
assert.ok(shell.includes('name="chevron-left"'));
assert.ok(shell.includes("minHeight: bodyFrameDesign.minTouchSize"));

for (const [name, source] of [["section", section], ["action row", row]]) {
  assert.ok(source.includes('from "@/components/app-text"'), name + " must use AppText");
  assert.ok(source.includes("bodyFrameTypography"), name + " must use common typography");
  assert.ok(!source.includes("fontSizeScale"), name + " must leave font scaling to AppText");
}
assert.ok(appText.includes("StyleSheet.flatten(style)"));
assert.ok(appText.includes("resolvedStyle.lineHeight * fontSizeScale"));
assert.ok(row.includes("minWidth: bodyFrameDesign.minTouchSize"));
assert.ok(row.includes("minHeight: bodyFrameDesign.minTouchSize"));

console.log("ok - Body Frame Stage 1 contrast, semantic controls, typography, tap targets, and routes");
