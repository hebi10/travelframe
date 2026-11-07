import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const files = [
  "components/app-guide-overlay.tsx",
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "hooks/use-app-guide.ts"
];
const [guide, project, guideHook] = files.map(path => fs.readFileSync(path, "utf8"));

test("Stage C onboarding and creation TSX parse", () => {
  for (const path of files.slice(0, 2)) {
    const source = ts.createSourceFile(path, fs.readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(source.parseDiagnostics.length, 0, path);
  }
});

test("Stage C first-run welcome is immersive but replay remains a guide", () => {
  assert.ok(guide.includes('step.id === "body-frame-welcome" && replaySignal === 0'));
  assert.ok(guide.includes("styles.welcomeBackdrop"));
  assert.ok(guide.includes("styles.welcomeModal"));
  assert.ok(guide.includes("styles.welcomeScrollContainer"));
  assert.ok(guide.includes("styles.welcomeArtwork"));
  assert.ok(guide.includes('onPress={goNext}'));
  assert.ok(guide.includes('onPress={skip}'));
  assert.ok(guide.includes("나중에 보기"));
  assert.ok(guide.includes("onNext={goNext}"));
  assert.ok(guide.includes("AppGuideCard"));
  assert.ok(guideHook.includes("shouldShowInitialAppGuide()"));
  assert.ok(guideHook.includes("markAppGuideIntroSeen()"));
  assert.ok(guideHook.includes("replaySignal <= 0"));
  assert.ok(guideHook.includes("!autoShowFirstRun"));
  const settings = fs.readFileSync("features/settings/BodyFrameSettingsScreen.tsx", "utf8");
  assert.ok(settings.includes("autoShowFirstRun={false}"));
});

test("Stage C project sheet clarifies policy and reference mode without changing creation semantics", () => {
  for (const token of [
    "촬영 기준 사진 방식",
    "두 번째 촬영부터 겹쳐 볼 사진을 선택합니다.",
    'accessibilityLabel="최근 사진을 기준으로 촬영"',
    'accessibilityLabel="첫 번째 사진을 기준으로 촬영"',
    "value === \"custom\"",
    "isBodyFrameProjectTargetAllowed",
    "getBodyFrameProjectCreationLimitState",
    "maxProgressPhotos",
    "targetPreset === \"365\"",
    "referenceMode",
    "onCreateProject({",
    "KeyboardAvoidingView",
    "keyboardShouldPersistTaps=\"handled\"",
    "styles.createFooter"
  ]) assert.ok(project.includes(token), token);
  assert.match(project, /referenceChoice:\s*\{[^}]*minHeight:\s*56/);
  assert.ok(project.includes("장 ·"));
  assert.ok(project.includes('backgroundColor: referenceMode === "latest" ? palette.surfaceStrong : palette.surface'));
  assert.ok(project.includes('backgroundColor: referenceMode === "first" ? palette.surfaceStrong : palette.surface'));
});

test("Stage C Android QA distinguishes initial launch from settings replay", () => {
  const qa = fs.readFileSync("scripts/capture-android-qa.py", "utf8");
  const cases = fs.readFileSync("scripts/capture-stage13-android.py", "utf8");
  assert.ok(qa.includes("intro_seen=True"));
  assert.ok(qa.includes("seenIntro=intro_seen"));
  assert.ok(qa.includes("device.find_control('다음')"));
  assert.ok(cases.includes('intro_seen=False'));
  assert.ok(cases.includes('"onboarding-first-run"'));
  assert.ok(cases.includes('"시작하기", "나중에 보기"'));
  assert.ok(cases.includes('"onboarding-welcome"'));
  assert.ok(cases.includes('"바디 프레임에 오신 것을 환영합니다.", "다음"'));
});
