import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const paths = [
  "components/body-frame-sheet.tsx",
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "features/records/PhotoPositionSheet.tsx",
  "features/records/BodyMeasurementEditorSheet.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/trip-clip/BodyFrameVideoOptionsSheet.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx",
  "features/account/AccountScreen.tsx",
  "features/camera/CameraScreen.tsx",
  "components/app-guide-overlay.tsx"
];
const sources = Object.fromEntries(paths.map((path) => [path, read(path)]));
const source = (path) => sources[path];

for (const [path, content] of Object.entries(sources)) {
  const parsed = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(
    parsed.parseDiagnostics.length, 0,
    path + " must remain valid TypeScript/TSX: " +
      parsed.parseDiagnostics.map((diagnostic) => diagnostic.messageText).join("; ")
  );
}

const modernModalCounts = [
  ["features/camera/BodyFrameProjectSwitcher.tsx", 2],
  ["features/records/PhotoPositionSheet.tsx", 1],
  ["features/records/BodyMeasurementEditorSheet.tsx", 1],
  ["features/trip-clip/BodyFrameVideoOptionsSheet.tsx", 1],
  ["features/records/BodyFrameProjectDetailScreen.tsx", 2],
  ["features/settings/BodyFrameSettingsScreen.tsx", 1],
  ["features/account/AccountScreen.tsx", 2],
  ["features/camera/CameraScreen.tsx", 2],
  ["components/app-guide-overlay.tsx", 1]
];
assert.equal(modernModalCounts.reduce((sum, [, count]) => sum + count, 0), 13);
for (const [path, expected] of modernModalCounts) {
  const content = source(path);
  assert.equal((content.match(/<Modal\b/g) ?? []).length, expected, path + " must preserve its modal count");
  assert.equal(
    (content.match(/\baccessibilityViewIsModal\b/g) ?? []).length,
    expected,
    path + " must isolate every modal from its underlying accessibility hierarchy"
  );
}

const theme = read("constants/app-theme.ts");
const common = source("components/body-frame-sheet.tsx");
assert.ok(theme.includes("export const bodyFrameSheetDesign = {"));
for (const token of [
  'backdropColor: "rgba(0,0,0,0.62)"',
  'maxHeight: "86%"',
  "handleWidth: 36",
  "handleHeight: 4",
  "footerGap: 10"
]) {
  assert.ok(theme.includes(token), "shared sheet design must contain " + token);
}
for (const token of [
  "export function BodyFrameSheetHandle",
  "importantForAccessibility=\"no\"",
  'accessibilityLabel={closeLabel}',
  "minHeight: bodyFrameDesign.primaryButtonHeight",
  "numberOfLines={2}",
  "primaryBackground",
  "primaryForeground"
]) {
  assert.ok(common.includes(token), "sheet primitives must contain " + token);
}

const chooser = source("features/camera/BodyFrameProjectSwitcher.tsx");
assert.equal((chooser.match(/<Modal\b/g) ?? []).length, 2);
assert.ok(chooser.includes('accessibilityLabel="프로젝트 선택 닫기"'));
assert.ok(chooser.includes('accessibilityLabel="새 프로젝트 닫기"'));
assert.ok(chooser.includes("StyleSheet.absoluteFill"));
assert.ok(chooser.includes("accessibilityViewIsModal"));
assert.ok(chooser.includes("createScroll: { flexShrink: 1, minHeight: 0 }"));
assert.ok(chooser.includes("bodyFrameSheetDesign.maxHeight"));
assert.ok(!chooser.includes("onPress={() => undefined}"), "sheet body must not rely on no-op press to stop backdrop close");
assert.ok(chooser.includes('onPress={() => void submitProject()}'));
assert.ok(chooser.includes("onCreateProject") && chooser.includes("onSelectProject"));

const position = source("features/records/PhotoPositionSheet.tsx");
assert.ok(position.includes("BodyFrameSheetHandle"));
assert.ok(position.includes("accessibilityViewIsModal"));
assert.ok(position.includes('behavior={Platform.OS === "ios" ? "padding" : "height"}'));
assert.ok(position.includes("styles.contentScroll"));
assert.ok(position.includes("flexShrink: 1, minHeight: 0"));
assert.ok(position.includes("BodyFrameSheetFooter"));
assert.ok(position.includes("getPhotoPositionIndex"));
assert.ok(position.includes("if (targetIndex !== null) onMove(targetIndex)"));

const measurement = source("features/records/BodyMeasurementEditorSheet.tsx");
assert.ok(measurement.includes("BodyFrameSheetHandle"));
assert.ok(measurement.includes("accessibilityViewIsModal"));
assert.ok(measurement.includes('accessibilityLabel="기록 날짜"'));
assert.ok(measurement.includes('accessibilityLabel="수치 기록 메모"'));
assert.ok(measurement.includes("styles.contentScroll"));
assert.ok(measurement.includes('keyboardDismissMode="on-drag"'));
assert.ok(measurement.includes('accessibilityState={{ disabled: saving }}'));
assert.ok(measurement.includes("BodyFrameSheetFooter"));
assert.ok(measurement.includes("saveBodyMeasurement") && measurement.includes("deleteBodyMeasurement"));
assert.ok(
  measurement.indexOf("style={styles.contentScroll}") <
    measurement.indexOf("<BodyFrameSheetFooter"),
  "sheet content should scroll independently of save/delete actions"
);

const videoOptions = source("features/trip-clip/BodyFrameVideoOptionsSheet.tsx");
assert.ok(videoOptions.includes("BodyFrameSheetHandle"));
assert.ok(videoOptions.includes("getBodyFrameControlColors(palette)"));
assert.ok(videoOptions.includes('accessibilityRole="checkbox"'));
assert.ok(videoOptions.includes('accessibilityRole="radio"'));
assert.ok(videoOptions.includes("styles.photoList"));
assert.ok(videoOptions.includes("minHeight: 0"));
assert.ok(videoOptions.includes("OptionContent"));
assert.ok(videoOptions.includes("BodyFrameSheetFooter"));
assert.ok(videoOptions.includes("onApply(draftOptions, draftIds)"));
assert.ok(!videoOptions.includes("bodyFrameAccent"), "choices should not use status green as the default selection");

const project = source("features/records/BodyFrameProjectDetailScreen.tsx");
assert.equal((project.match(/<Modal\b/g) ?? []).length, 2);
assert.equal((project.match(/<BodyFrameSheetHandle\s*\/>/g) ?? []).length, 2);
assert.ok(project.includes("bodyFrameSheetDesign.maxHeight"));
assert.ok(project.includes("modalSelectionColor"));
assert.ok(project.includes("modalSelectionText"));
assert.ok(project.includes("settingsScroll: {\n    flexShrink: 1,\n    minHeight: 0"));
assert.ok(project.includes('behavior={Platform.OS === "ios" ? "padding" : "height"}'));
assert.ok(project.includes("onConfirm={() => void saveReminderSettings()}"));
assert.ok(project.includes("onConfirm={() => void saveBasicInfo()}"));
assert.ok(project.includes("onPress={confirmArchive}"));
assert.ok(project.includes("PhotoPositionSheet"));

const settings = source("features/settings/BodyFrameSettingsScreen.tsx");
assert.ok(settings.includes("styles.optionScroll"));
assert.ok(settings.includes("BodyFrameSheetHandle"));
assert.ok(settings.includes("bodyFrameSheetDesign.maxHeight"));
assert.ok(settings.includes("StyleSheet.absoluteFill"));
assert.ok(settings.includes('accessibilityLiveRegion="polite"'));
assert.ok(!settings.includes("onPress={() => undefined}"));
assert.ok(settings.includes("saveAppSettings"));

const account = source("features/account/AccountScreen.tsx");
const accountStyles = read("features/account/account-screen.styles.ts");
assert.equal((account.match(/<BodyFrameSheetHandle\s*\/>/g) ?? []).length, 2);
assert.ok(account.includes("accessibilityViewIsModal"));
assert.ok((account.match(/style={styles.paymentModalScroll}/g) ?? []).length >= 2);
assert.ok(account.includes("selectedPaymentPlan"));
assert.ok(account.includes("onPress={handlePaymentPurchase}"));
assert.ok(account.includes("purchaseProduct(") && account.includes("restorePurchases"));
assert.ok(account.includes("confirmCloudRestore"));
assert.ok(accountStyles.includes("bodyFrameSheetDesign.maxHeight"));
assert.ok(accountStyles.includes("bodyFrameSheetDesign.backdropColor"));
assert.ok(accountStyles.includes("paymentModalAction: { paddingTop: 8 }"));

const camera = source("features/camera/CameraScreen.tsx");
const cameraStyles = read("features/camera/camera-screen.styles.ts");
assert.ok(camera.includes('accessibilityLabel="촬영 설정 닫기"'));
assert.ok(camera.includes('accessibilityLabel="가이드 설정 닫기"'));
assert.ok(camera.includes("accessibilityViewIsModal"));
assert.ok(camera.includes("styles.guideSettingsScroll"));
assert.ok(camera.includes('keyboardDismissMode="on-drag"'));
assert.ok(cameraStyles.includes("bodyFrameSheetDesign.maxHeight"));
assert.ok(cameraStyles.includes("guideSettingsScroll: {\n    flexGrow: 0,\n    flexShrink: 1,\n    minHeight: 0"));

const guide = source("components/app-guide-overlay.tsx");
assert.ok(guide.includes("accessibilityViewIsModal"));
assert.ok(guide.includes("contentScroll: { flexShrink: 1, minHeight: 0 }"));
assert.ok(guide.includes("onRequestClose={skip}"));

for (const content of Object.values(sources)) {
  assert.ok(!/border(?:Top|Bottom|Left|Right)Width\s*:/.test(content), "modern screens should not introduce one-sided borders");
  assert.ok(!/shadowColor|shadowOpacity|elevation:|LinearGradient/.test(content), "modern screens should remain flat");
}
console.log("ok - Body Frame Stage 4 modal, keyboard, pinned action and safety contracts");
