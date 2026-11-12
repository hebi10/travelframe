import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");
const paths = [
  "components/app-guide-overlay.tsx",
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx",
  "features/account/AccountScreen.tsx"
];
const [guide, project, settings, account] = paths.map(read);
const accountStyles = read("features/account/account-screen.styles.ts");
const workflow = read(".github/workflows/body-frame-device-qa.yml");
const capture = read("scripts/run_ui_r07_keyboard_qa.py");
const audit = read("scripts/verify_ui_r07_keyboard_qa.py");

test("UI-R07 four screens remain valid TSX with existing four policies intact", () => {
  paths.forEach((path, index) => {
    const ast = ts.createSourceFile(path, [guide, project, settings, account][index], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(ast.parseDiagnostics.length, 0, path + " invalid TypeScript");
    assert.doesNotMatch(read(path), /border(?:Left|Right|Top|Bottom)Width\s*:/);
    assert.doesNotMatch(read(path), /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
  });
  assert.ok(account.includes("purchaseProduct("));
  assert.ok(account.includes("restorePurchases"));
  assert.ok(account.includes("confirmCloudRestore"));
  assert.ok(account.includes("CloudBackupProjectSlotsSection"));
  assert.ok(settings.includes("saveAppSettings("));
  assert.ok(project.includes("getBodyFrameProjectCreationLimitState"));
  assert.ok(project.includes("isBodyFrameProjectTargetAllowed"));
});

test("UI-R07 first-run onboarding scales artwork while leaving primary and skip actions pinned", () => {
  for (const token of [
    "useWindowDimensions",
    "const compactWelcome = windowHeight < 720 || fontSizeScale * systemFontScale >= 1.3;",
    "styles.welcomeContentCompact",
    "styles.welcomeArtworkCompact",
    "height: 116",
    'accessibilityRole="header"',
    "styles.welcomeActions",
    'onPress={goNext}',
    'onPress={skip}',
    "나중에 보기",
    "onNext={goNext}",
    "maxHeight: \"100%\"",
    "welcomeScrollContainer"
  ]) assert.ok(guide.includes(token), token);
  assert.ok(guide.indexOf("</ScrollView>") < guide.indexOf("styles.welcomeActions"));
  assert.ok(guide.includes("minHeight: bodyFrameDesign.primaryButtonHeight"));
});

test("UI-R07 project sheet keeps keyboard-aware fixed create/cancel footer at 150 percent", () => {
  for (const token of [
    "Keyboard.addListener(\"keyboardDidShow\"",
    "Keyboard.addListener(\"keyboardDidHide\"",
    "keyboardVisible ? 8 : Math.max(insets.bottom, 16)",
    "keyboardVisible && styles.createFooterKeyboard",
    "nestedScrollEnabled",
    "createScroll: { flexShrink: 1, minHeight: 0 }",
    'keyboardDismissMode="on-drag"',
    "flexShrink: 0",
    "minHeight: 64",
    "confirmFlex={1.6}",
    'onConfirm={() => void submitProject()}',
    "referenceMode",
    "onCreateProject({"
  ]) assert.ok(project.includes(token), token);
  const createSheet = project.slice(project.indexOf("visible={createOpen}"));
  assert.ok(createSheet.indexOf("styles.createFooter") > createSheet.indexOf("</ScrollView>"));
  assert.ok(createSheet.includes("accessibilityViewIsModal"));
  assert.ok(createSheet.includes('accessibilityLabel="프로젝트 이름"'));
  assert.ok(createSheet.includes('accessibilityLabel="목표 기록 수 직접 입력"'));
  assert.ok(project.includes("setCreateError(") && project.includes("!projectLimitState.allowed"));
});

test("UI-R07 settings row wraps current values on small screens and modal remains scrollable", () => {
  for (const token of [
    "useWindowDimensions",
    "const wrapValue = width <= 412 && fontSizeScale * systemFontScale >= 1.3;",
    "styles.settingRowLargeText",
    "styles.settingRowValueLargeText",
    'numberOfLines={wrapValue ? 2 : 1}',
    'flexWrap: "wrap"',
    "maxWidth: \"100%\"",
    "accessibilityHint={onPress ? detail : undefined}",
    'accessibilityState={{ selected: active, disabled }}',
    "paddingTop: Math.max(insets.top + 14, 24)",
    "paddingBottom: Math.max(insets.bottom + 14, 24)",
    "maxHeight: bodyFrameSheetDesign.maxHeight",
    "nestedScrollEnabled"
  ]) assert.ok(settings.includes(token), token);
  for (const group of ["촬영", "저장 및 백업", "변화 영상", "화면", "계정 및 플랜", "정보 및 개인정보"]) {
    assert.ok(settings.includes('SectionBlock title="' + group + '"'));
  }
});

test("UI-R07 account prevents text clipping without altering subscriptions, restore or deletion", () => {
  for (const token of [
    'numberOfLines={2}',
    'accessibilityLabel="로그인 이메일"',
    'accessibilityLabel="계정 비밀번호"',
    "accessibilityState={{ disabled: isSubmitting || isAuthLoading }}",
    "accessibilityState={{ disabled: isSubmitting || isAuthLoading || isGoogleSubmitting }}",
    'accessibilityLiveRegion="polite"',
    "modalSafeStyle",
    "selectedPaymentPlan",
    'onPress={handlePaymentPurchase}',
    "openDeleteRequestPage",
    "GOOGLE_PLAY_SUBSCRIPTIONS_URL",
    "PRIVACY_POLICY_URL"
  ]) assert.ok(account.includes(token), token);
  assert.ok(accountStyles.includes('flexWrap: "wrap"'));
  assert.ok(accountStyles.includes("paymentModalAction: { paddingTop: 8 }"));
  assert.ok(accountStyles.includes("maxHeight: bodyFrameSheetDesign.maxHeight"));
  assert.ok(accountStyles.includes("paymentModalScroll: { flexShrink: 1, minHeight: 0 }"));
  assert.ok(accountStyles.includes("planCopy: {\n    flex: 1,\n    minWidth: 0"));
  assert.equal((account.match(/<Modal\b/g) ?? []).length, 2);
});

test("UI-R07 reuses real 24-cell Android pixel matrix and independently audits 150-percent keyboard", () => {
  for (const token of [
    "ui-r07-visual-verify:",
    "ui-r07-native-keyboard:",
    "ui-r07-keyboard-verify:",
    "startsWith(github.head_ref, 'ui/ui-r07-')",
    "scripts/run_ui_r07_keyboard_qa.py",
    "scripts/verify_ui_r07_keyboard_qa.py",
    "scripts/verify-frame-journal-c7.py --root artifacts/c7-captures",
    "body-frame-stage13-*-${{ github.run_id }}"
  ]) assert.ok(workflow.includes(token), token);
  for (const profile of ["phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp"]) assert.ok(workflow.includes(profile));
  assert.ok(capture.includes('"font_scale", "1.5"'));
  assert.ok(capture.includes("qa.creation_keyboard") && capture.includes("qa.creation_submit"));
  assert.ok(capture.includes('ro.kernel.qemu') && capture.includes('"wifi", "disable"'));
  assert.ok(audit.includes("projectPersisted") && audit.includes("keyboardVisibleBeforeActivation"));
  assert.ok(audit.includes("physicalBackActionCount") && audit.includes("sha256"));
  assert.doesNotMatch(workflow, /\[deploy-closed\]|\[publish-store-shots\]/);
});
