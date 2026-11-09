import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const path = "features/camera/BodyFrameProjectSwitcher.tsx";
const source = fs.readFileSync(path, "utf8");

test("C2 project sheet remains valid TSX with two accessible native modals", () => {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  assert.equal((source.match(/<Modal\\b/g) ?? []).length, 2);
  assert.equal((source.match(/\\baccessibilityViewIsModal\\b/g) ?? []).length, 2);
  assert.ok(source.includes("BodyFrameSheetHandle"));
  assert.ok(source.includes("BodyFrameSheetHeader"));
  assert.ok(source.includes("BodyFrameSheetFooter"));
  assert.ok(source.includes("bodyFrameSheetDesign.maxHeight"));
  assert.ok(source.includes("StyleSheet.absoluteFill"));
});

test("C2 picker prioritizes active project, counts and a reachable action row", () => {
  const picker = source.slice(source.indexOf("visible={pickerOpen}"), source.indexOf("visible={createOpen}"));
  assert.ok(picker.includes("visibleProjects.length}개"));
  assert.ok(picker.includes("visibleProjects.length === 0"));
  assert.ok(picker.includes("진행 중인 프로젝트가 없습니다."));
  assert.ok(picker.includes("summary.photoCount} / {summary.targetPhotoCount}장"));
  assert.ok(picker.includes("formatDuration(summary.durationSeconds)"));
  assert.ok(picker.includes("styles.selectedProjectMarker"));
  assert.ok(picker.includes("촬영 중"));
  assert.ok(picker.includes('accessibilityRole="radio"'));
  assert.ok(picker.includes("accessibilityState={{ selected, disabled }}"));
  assert.ok(picker.includes("selected ? palette.surfaceStrong : palette.surface"));
  assert.ok(picker.includes('accessibilityLabel="+ 새 프로젝트"'));
  assert.ok(picker.includes("onPress={openCreateSheet}"));
  assert.ok(picker.includes("onManageProjects?.()"));
  assert.ok(picker.indexOf("styles.sheetActions") > picker.indexOf("</ScrollView>"));
});

test("C2 create sheet preserves name, targets and reference mode with fixed footer", () => {
  const sheet = source.slice(source.indexOf("visible={createOpen}"));
  for (const token of [
    "KeyboardAvoidingView", 'behavior={Platform.OS === "ios" ? "padding" : "height"}',
    'keyboardShouldPersistTaps="handled"', 'keyboardDismissMode="on-drag"',
    'accessibilityLabel="프로젝트 이름"', "maxLength={40}", "100", "365", "custom",
    "getBodyFrameProjectCreationLimitState", "isBodyFrameProjectTargetAllowed",
    'accessibilityLabel="최근 사진을 기준으로 촬영"',
    'accessibilityLabel="첫 번째 사진을 기준으로 촬영"',
    "onCreateProject({", "styles.createFooter", "<BodyFrameSheetFooter",
    'onConfirm={() => void submitProject()}', "프로젝트 만들기"
  ]) assert.ok(sheet.includes(token), token);
  assert.ok(sheet.indexOf("styles.createFooter") > sheet.indexOf("</ScrollView>"));
  assert.ok(sheet.includes('onRequestClose={dismissCreateSheet}'));
  assert.ok(source.includes("if (!submitting) {\n      setCreateOpen(false);"));
  assert.ok(source.includes("} catch (error) {"));
  assert.ok(sheet.includes('accessibilityLiveRegion="polite"'));
});

test("C2 keeps flat Frame Journal styling, 44dp controls and scrollable lists", () => {
  for (const token of [
    "pickerSummaryRow:", "projectListContent:", "emptyProjectState:",
    "selectedProjectMarker:", "pickerCreateAction:", "pickerManageAction:",
    "formSectionHeader:", "referenceSectionHeader:",
    "createScroll: { flexShrink: 1, minHeight: 0 }",
    "maxHeight: bodyFrameSheetDesign.maxHeight",
    "minHeight: bodyFrameDesign.primaryButtonHeight",
    "borderWidth: bodyFrameDesign.borderWidth",
    "minHeight: 56"
  ]) assert.ok(source.includes(token), token);
  assert.doesNotMatch(source, /border(?:Top|Bottom|Left|Right)Width\\s*:/);
  assert.doesNotMatch(source, /shadowOpacity|shadowColor|elevation:|LinearGradient/);
});
