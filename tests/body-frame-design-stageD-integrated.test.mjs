import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const studioStyles = read("features/studio/studio-screen.styles.ts");
const studioActions = read("features/studio/studio-screen.components.tsx");
const workflow = read(".github/workflows/body-frame-device-qa.yml");
const stage13 = read("scripts/capture-stage13-android.py");
const capture = read("scripts/capture-android-qa.py");
const visualAudit = read("scripts/check-stage6-visual-artifacts.py");
const theme = read("constants/app-theme.ts");

test("Stage D legacy photo and work controls retain at least 44dp touch height", () => {
  assert.ok(theme.includes("minTouchSize: 44"), "shared minTouchSize must remain 44dp");
  for (const style of ["cardButton", "cardLightButton", "paginationButton", "workEditButton", "workDeleteButton", "retryButton"]) {
    assert.match(studioStyles, new RegExp(style + ":\\s*\\{[^}]*minHeight:\\s*bodyFrameDesign\\.minTouchSize"), style);
  }
  assert.match(studioStyles, /workDeleteButton:\s*\{[^}]*minWidth:\s*bodyFrameDesign\.minTouchSize/);
  assert.match(studioStyles, /paginationBar:\s*\{[^}]*minHeight:\s*bodyFrameDesign\.minTouchSize/);
});

test("Stage D gallery actions stay accessible and retain editing, viewing and deletion", () => {
  const parsed = ts.createSourceFile("studio-screen.components.tsx", studioActions, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0);
  for (const label of ["사진 상세 보기", "사진 편집", "사진 보기", "사진 삭제"]) {
    assert.ok(studioActions.includes(label), label);
  }
  assert.ok(studioActions.includes("accessibilityRole=\"button\""));
  assert.ok(studioActions.includes("onRequireLoginForEdit()"));
  assert.ok(studioActions.includes("/edit?photoId="));
  assert.ok(studioActions.includes("onDelete(photo)"));
  assert.ok(studioActions.includes("/photo/"));
});

test("Stage D tests Android dark/light modes with 150% system font independently", () => {
  assert.ok(capture.includes("('light-150', 'light', 'large', 1.5)"));
  assert.ok(capture.includes("('dark-150', 'dark', 'large', 1.5)"));
  for (const variant of ["dark-100", "light-100", "dark-130", "light-130", "dark-150", "light-150"]) {
    assert.ok(stage13.includes('"' + variant + '"'), variant);
  }
  assert.ok(stage13.includes("for variant in C7_VARIANTS:"));
  assert.ok(stage13.includes('"onboarding-first-run-light-large"'));
  assert.ok(stage13.includes('"new-project-light-large"'));
  assert.ok(stage13.includes("intro_seen=False"));
  assert.ok(visualAudit.includes('("light", 1.5)'));
  for (const name of ["phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp"]) {
    assert.ok(workflow.includes(name));
    assert.ok(capture.includes("'" + name + "'"));
  }
  assert.ok(workflow.includes("startsWith(github.head_ref, 'feat/body-frame-design-stageD-')"));
  assert.equal(workflow.includes("secrets.ANDROID_KEYSTORE_BASE64"), false);
});

test("Stage D keeps photo, video export, billing, and Play release code outside its scope", () => {
  assert.equal(studioStyles.includes("LinearGradient"), false);
  assert.doesNotMatch(studioActions, /shadowOpacity|elevation:\s*[1-9]/);
  const play = read(".github/workflows/android-play-aab.yml");
  assert.ok(play.includes("BODY_FRAME_PLAY_SIGNING_APPROVED_20261107"));
  assert.ok(play.includes("workflow_dispatch"));
  assert.ok(read("features/trip-clip/BodyFrameVideoScreen.tsx").includes("saveMadeVideo("));
  assert.ok(read("features/records/BodyFrameRecordsScreen.tsx").includes("getBodyFrameProjectCreationLimitState"));
});
