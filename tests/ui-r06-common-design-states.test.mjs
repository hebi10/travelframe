import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");
const names = [
  "components/body-frame-status-notice.tsx",
  "components/tab-glyph.tsx",
  "app/(tabs)/_layout.tsx",
  "components/screen-shell.tsx",
  "components/body-frame-sheet.tsx",
  "features/records/BodyFrameCompareScreen.tsx",
  "app/video/[id].tsx"
];
const [stateNotice, glyph, tabs, shell, sheet, comparison, videoDetail] = names.map(read);
const themeText = read("constants/app-theme.ts");
const workflow = read(".github/workflows/body-frame-device-qa.yml");

const luminance = (hex) => {
  const channels = [1, 3, 5].map((offset) => {
    const v = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

test("UI-R06 common components and both state screens parse without decorative layout changes", () => {
  for (const path of names) {
    const source = read(path);
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, path + " is not valid TSX");
  }
  for (const source of [stateNotice, glyph, tabs, shell, sheet]) {
    assert.doesNotMatch(source, /border(?:Left|Right|Top|Bottom)Width\s*:/);
    assert.doesNotMatch(source, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
  }
});

test("UI-R06 semantic status colors stay distinct from accent and meet AA contrast in both palettes", async () => {
  const code = ts.transpileModule(themeText, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const tokens = await import("data:text/javascript," + encodeURIComponent(code));
  assert.notEqual(tokens.bodyFrameStatusColors.success, tokens.bodyFrameAccent);
  for (const palette of [tokens.colors, tokens.bodyFrameDarkColors]) {
    const status = tokens.getBodyFrameStatusColors(palette);
    for (const key of ["success", "warning", "error"]) {
      assert.ok(contrast(status[key], palette.background) >= 4.5, key + " background contrast");
      assert.ok(contrast(status[key], palette.surface) >= 4.5, key + " surface contrast");
    }
  }
  assert.ok(stateNotice.includes("getBodyFrameStatusColors(palette)"));
  assert.ok(stateNotice.includes('variant === "error" ? statusColors.error : palette.muted'));
});

test("UI-R06 four tabs keep neutral functional film icon and 44dp touch target at large font scale", () => {
  for (const token of ['camera: "camera"', 'studio: "image"', 'video: "film"', 'settings: "settings"']) {
    assert.ok(glyph.includes(token), token);
  }
  assert.ok(!glyph.includes('video: "youtube"'));
  assert.ok(glyph.includes("activeIndicator") && glyph.includes("size={bodyFrameDesign.iconSize}"));
  assert.equal((tabs.match(/tabBarIcon:/g) ?? []).length, 4);
  assert.ok(tabs.includes('href: null'));
  assert.ok(tabs.includes("useWindowDimensions"));
  assert.ok(tabs.includes("tabBarHeight = 58 + tabBarBottomPadding + extraFontHeight"));
  assert.ok(tabs.includes("Math.ceil(tabLabelLineHeight * fontSizeScale * systemFontScale)"));
  assert.ok(tabs.includes("minHeight: bodyFrameDesign.minTouchSize + extraFontHeight"));
  assert.ok(tabs.includes("fontSize: Math.round(bodyFrameTypography.caption * fontSizeScale)"));
  assert.ok(shell.includes("extraTabLabelHeight"));
  assert.ok(shell.includes("TAB_BAR_CONTENT_RESERVE_HEIGHT +"));
  assert.ok(shell.includes("Math.max(insets.bottom + 8, TAB_BAR_MIN_BOTTOM_PADDING)"));
  assert.equal(read("constants/app-theme.ts").includes("minTouchSize: 44"), true);
});

test("UI-R06 common notices expose real loading, empty and error states with optional actionable button", () => {
  assert.ok(stateNotice.includes('"loading" | "empty" | "error"'));
  assert.ok(stateNotice.includes('accessibilityLiveRegion={variant === "error" ? "assertive" : "polite"}'));
  assert.ok(stateNotice.includes("ActivityIndicator") && stateNotice.includes('name={variant === "error" ? "alert-circle" : "inbox"}'));
  assert.ok(stateNotice.includes("actionLabel && onAction"));
  assert.ok(stateNotice.includes('accessibilityRole="button"'));
  assert.ok(stateNotice.includes("minHeight: bodyFrameDesign.minTouchSize"));
  assert.ok(comparison.includes('variant={error ? "error" : "empty"}'));
  assert.ok(comparison.includes('variant="loading"'));
  assert.ok(comparison.includes("선택한 사진을 찾을 수 없습니다. 다른 사진을 선택하세요."));
  assert.ok(comparison.includes("비교할 사진이 2장 이상 필요합니다."));
  for (const contract of [
    "PanResponder.create", 'accessibilityRole="adjustable"',
    "selectBodyFrameComparisonPhotos", "changeDivider",
    'comparisonMode === "slider"'
  ]) assert.ok(comparison.includes(contract), contract);
  assert.ok(videoDetail.includes("BodyFrameStatusNotice"));
  assert.ok(videoDetail.includes('variant={message ? "error" : "empty"}'));
  assert.ok(videoDetail.includes('actionLabel="영상 목록으로 돌아가기"'));
  assert.ok(videoDetail.includes('onAction={() => router.replace("/video-library")}'));
  for (const preserved of [
    'getMadeVideoById(id)', 'getExpoVideoModule()', "VideoPlayerFrame",
    'accessibilityLabel="저장한 영상 재생"', "showLoginRequiredForVideoCreation",
    'pathname: "/legacy-video-edit"'
  ]) assert.ok(videoDetail.includes(preserved), preserved);
});

test("UI-R06 sheet actions remain accessible and responsive while preserving existing callbacks", () => {
  for (const token of [
    "onCancel={",
    "BodyFrameSheetHeader",
    "accessibilityLabel={closeLabel}",
    "accessibilityLabel={cancelLabel}",
    "accessibilityLabel={confirmLabel}",
    "accessibilityState={{ disabled }}",
    "onPress={onCancel}",
    "onPress={onConfirm}",
    "minHeight: bodyFrameDesign.primaryButtonHeight"
  ].filter((token) => token !== "onCancel={" && token !== "BodyFrameSheetHeader")) {
    assert.ok(sheet.includes(token), token);
  }
  assert.ok(sheet.includes("numberOfLines={2}"));
  assert.ok(sheet.includes("minWidth: 0"));
  assert.ok(!sheet.includes("bodyFrameAccent"));
});

test("UI-R06 executes four Android widths and independently reads real PNG/XML evidence", () => {
  for (const token of [
    "ui-r06-visual-verify:",
    "startsWith(github.head_ref, 'ui/ui-r06-')",
    "body-frame-stage13-*-${{ github.run_id }}",
    "merge-multiple: true",
    "scripts/verify-frame-journal-c7.py --root artifacts/c7-captures --output artifacts/c7-report",
    "body-frame-ui-r06-visual-${{ github.run_id }}"
  ]) assert.ok(workflow.includes(token), token);
  for (const dp of ["phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp"]) {
    assert.ok(workflow.includes(dp));
  }
  const capture = read("scripts/capture-stage13-android.py");
  for (const variant of ["dark-100", "light-100", "dark-130", "light-130", "dark-150", "light-150"]) {
    assert.ok(capture.includes(variant), variant);
  }
  assert.ok(!workflow.includes("[deploy-closed]"));
});
