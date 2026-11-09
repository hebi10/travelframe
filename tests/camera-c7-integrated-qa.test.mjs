import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stage13 = fs.readFileSync("scripts/capture-stage13-android.py", "utf8");
const validator = fs.readFileSync("scripts/verify-frame-journal-c7.py", "utf8");
const workflow = fs.readFileSync(".github/workflows/body-frame-device-qa.yml", "utf8");
const records = fs.readFileSync("features/records/BodyFrameRecordsScreen.tsx", "utf8");
const sheets = fs.readFileSync("components/body-frame-sheet.tsx", "utf8");
const projectSwitcher = fs.readFileSync("features/camera/BodyFrameProjectSwitcher.tsx", "utf8");

test("C7 captures complete light/dark 100, 130, 150 percent matrix on four widths", () => {
  for (const variant of [
    "dark-100", "light-100", "dark-130", "light-130", "dark-150", "light-150"
  ]) {
    assert.ok(stage13.includes('"' + variant + '"'), variant);
    assert.ok(validator.includes('"' + variant + '"'), variant);
  }
  for (const profile of ["phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp"]) {
    assert.ok(validator.includes('"' + profile + '"'), profile);
  }
  assert.ok(stage13.includes("for variant in C7_VARIANTS:"));
  assert.ok(stage13.includes('if variant in ("dark-100", "light-100"):'));
  assert.ok(stage13.includes('elif variant in ("light-130", "dark-130"):'));
  assert.ok(stage13.includes("LARGE_TEXT.update(C7_PRIMARY)"));
});

test("C7 checks real APK source identity, PNG hash, UI accessibility and theme pixels", () => {
  for (const token of [
    "sourceCommit", "prHeadCommit", "captureMatrix", "sha256",
    "capture-manifest.json", "ET.fromstring", "settings_surface_brightness",
    "native_action_bounds", "pixelEvidenceValid", "onboarding-first-run",
    "camera-permission-denied", "camera-color-panel", "expected_cells",
    "c7-report.json", "c7-report.md"
  ]) assert.ok(validator.includes(token), token);
  assert.ok(validator.includes("Expected 24 profile/theme/font cells"));
  assert.ok(validator.includes("settings_surface_brightness(png)"));
  assert.ok(validator.includes('report["result"] == "PASS"'));
});

test("C7 actions upload a consolidated report only after inspecting native evidence from all widths", () => {
  assert.ok(workflow.includes("  c7-integrated-qa:"));
  assert.ok(workflow.includes("needs: stage13-design-captures"));
  assert.ok(workflow.includes("always() && startsWith(github.head_ref, 'feat/r3-frame-journal-camera-c7-')"));
  assert.ok(workflow.includes("body-frame-stage13-*-${{ github.run_id }}"));
  assert.ok(workflow.includes("merge-multiple: true"));
  assert.ok(workflow.includes("scripts/verify-frame-journal-c7.py --root artifacts/c7-captures --output artifacts/c7-report"));
  assert.ok(workflow.includes("body-frame-c7-integrated-qa-${{ github.run_id }}"));
  assert.ok(workflow.includes("C7_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}"));
  assert.ok(workflow.includes("scripts/test_verify_frame_journal_c7.py"));
  assert.ok(!workflow.includes("[deploy-closed]"));
  assert.ok(!workflow.includes("[publish-store-shots]"));
});

test("C7 corrects the confirmed 360dp 150% Records create-project word break", () => {
  assert.ok(records.includes("const { width: windowWidth, fontScale } = useWindowDimensions();"));
  assert.ok(records.includes("fontScale >= 1.3 && styles.quickActionsLargeFont"));
  assert.match(records, /quickActions:\s*\{\s*width:\s*184/);
  assert.match(records, /quickActionsLargeFont:\s*\{\s*width:\s*232/);
  assert.ok(records.includes("<BodyFrameProjectSwitcher"));
});

test("C7 expands only the create-project confirmation CTA and checks native single-line text", () => {
  assert.ok(sheets.includes("confirmFlex?: number;"));
  assert.ok(sheets.includes("confirmFlex = 1"));
  assert.ok(sheets.includes("{ flex: confirmFlex, borderColor: primaryBackground"));
  assert.ok(projectSwitcher.includes("confirmFlex={1.6}"));
  assert.ok(projectSwitcher.includes('confirmLabel={submitting ? "생성 중..." : "프로젝트 만들기"}'));
  assert.ok(validator.includes("def project_create_button_text_height_dp("));
  assert.ok(validator.includes('variant.endswith("-150") and screen in ("camera-new-project", "records")'));
  assert.ok(validator.includes('max_single_line_dp = 80 if label == "새 프로젝트" else 44'));
  assert.ok(validator.includes("if height_dp > max_single_line_dp:"));
});
