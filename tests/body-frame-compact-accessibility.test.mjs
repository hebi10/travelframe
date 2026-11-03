import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const read = (file) => fs.readFileSync(file, "utf8");
const camera = read("features/camera/CameraScreen.tsx");
const detail = read("features/records/BodyFrameProjectDetailScreen.tsx");
const records = read("features/records/BodyFrameRecordsScreen.tsx");
const slider = read("features/camera/camera-screen.components.tsx");
const switcher = read("features/camera/BodyFrameProjectSwitcher.tsx");
const guide = read("components/app-guide-overlay.tsx");
const failures = [];
const check = (name, run) => {
  try { run(); console.log(`ok - ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL - ${name}: ${error.message}`); }
};
const loadPure = async (file) => {
  const code = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
};
const evaluate = (expression, context) => vm.runInNewContext(ts.transpileModule(`(${expression})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText, context);
const findExpression = (source, predicate, extract) => {
  const ast = ts.createSourceFile("screen.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  const visit = (node) => {
    if (predicate(node, ast)) expression = extract(node).getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(expression, "production handler must exist");
  return expression;
};

check("album denial offers local app save without enabling backup", () => {
  const prompt = camera.slice(camera.indexOf("const showDeviceAlbumPermissionPrompt"), camera.indexOf("const queueCapturedPhotoSave"));
  assert.ok(prompt.includes("createAppOnlySaveFallback"));
  assert.equal(prompt.includes("클라우드로 저장"), false);
  assert.equal(prompt.includes("cloudBackupEnabled: true"), false);
});
await (async () => {
  try {
    const { createAppOnlySaveFallback } = await loadPure("features/camera/camera-save-fallback.ts");
    check("app-only fallback matches its label and turns backup off", () => {
      assert.deepEqual(createAppOnlySaveFallback(), {
        cameraSaveScope: "app", storageMode: "local_only", cloudBackupEnabled: false
      });
      assert.ok(camera.includes('text: "앱에만 저장"'));
    });
    const expression = findExpression(camera,
      (node, ast) => ts.isVariableDeclaration(node) && node.name.getText(ast) === "showDeviceAlbumPermissionPrompt",
      (node) => node.initializer.arguments[0]);
    const updates = [];
    let selectedScope;
    let actions;
    evaluate(expression, {
      createAppOnlySaveFallback, setErrorMessage: () => {},
      setCameraSaveScope: (scope) => { selectedScope = scope; },
      queueAppSettingsUpdate: (settings) => updates.push(settings),
      Alert: { alert: (_title, _message, buttons) => { actions = buttons; } },
      Linking: { openSettings: () => {} }
    })("권한 거절");
    actions.find((button) => button.text === "앱에만 저장").onPress();
    check("actual permission prompt callback applies the local fallback", () => {
      assert.equal(selectedScope, "app");
      assert.deepEqual(updates, [createAppOnlySaveFallback()]);
    });
  } catch (error) { failures.push("app-only fallback behavior"); console.error(`FAIL - app-only fallback behavior: ${error.message}`); }
})();
check("restore rechecks the active project limit before activating", () => {
  const restore = records.slice(records.indexOf("const restoreProject"), records.indexOf("const handleCreateProject"));
  assert.ok(restore.includes("await getBodyProjects()"));
  assert.ok(restore.includes("getBodyFrameProjectCreationLimitState"));
  assert.ok(restore.indexOf("if (!projectLimitState.allowed)") < restore.indexOf("await archiveBodyProject"));
  assert.ok(restore.includes('Alert.alert('));
});
const recordsAst = ts.createSourceFile("records.tsx", records, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let restoreCallback;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(recordsAst) === "restoreProject") {
    restoreCallback = node.initializer.arguments[0].getText(recordsAst);
  }
  ts.forEachChild(node, visit);
};
visit(recordsAst);
const { getBodyFrameProjectCreationLimitState } = await loadPure("lib/body-frame-plan-limits.ts");
for (const [activeCount, limit, expected] of [[1, 1, false], [0, 1, true], [50, null, true]]) {
  const calls = [];
  const callback = vm.runInNewContext(ts.transpileModule(`(${restoreCallback})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    getBodyProjects: async () => [
      ...Array.from({ length: activeCount }, (_, id) => ({ id: String(id), archived: false })),
      { id: "archive", archived: true }
    ],
    planEntitlements: { maxProjectCount: limit },
    projectActivationInFlight: { current: false },
    setRestoringProjectId: () => {},
    getBodyFrameProjectCreationLimitState,
    archiveBodyProject: async (...args) => calls.push(["archive", ...args]),
    setLastActiveProjectId: async () => calls.push(["active"]),
    reload: async () => calls.push(["reload"]),
    Alert: { alert: (...args) => calls.push(["alert", ...args]) },
    getUserFacingErrorMessage: (_, fallback) => fallback
  });
  await callback({ id: "archive", archived: true });
  check(`restoration at ${activeCount}/${limit ?? "unlimited"} active projects honors plan`, () => {
    assert.equal(calls.some(([kind]) => kind === "archive"), expected);
    if (!expected) assert.equal(calls.some(([kind]) => kind === "active"), false);
  });
}
{
  const activations = [];
  const callback = vm.runInNewContext(ts.transpileModule(`(${restoreCallback})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    getBodyProjects: async () => [],
    planEntitlements: { maxProjectCount: 1 },
    projectActivationInFlight: { current: false },
    setRestoringProjectId: () => {},
    getBodyFrameProjectCreationLimitState,
    archiveBodyProject: async (id) => { activations.push(id); },
    setLastActiveProjectId: async () => {}, reload: async () => {},
    Alert: { alert: () => {} }
  });
  await Promise.all([callback({ id: "first" }), callback({ id: "second" })]);
  check("rapid restore taps cannot activate two projects from the same available slot", () => {
    assert.equal(activations.length, 1);
  });
}
check("creation and onboarding content can scroll inside bounded containers", () => {
  const create = switcher.slice(switcher.indexOf("visible={createOpen}"));
  assert.ok(create.includes('<ScrollView'));
  assert.ok(create.includes('keyboardShouldPersistTaps="handled"'));
  assert.ok(create.includes('keyboardDismissMode="on-drag"'));
  assert.ok(create.indexOf("프로젝트 만들기") < create.indexOf("</ScrollView>"));
  assert.ok(guide.includes("<ScrollView"));
  assert.ok(guide.includes('maxHeight: "100%"'));
  assert.ok(read("components/app-guide-card.tsx").includes('flexWrap: "wrap"'), "guide footer must wrap for large fonts");
  assert.ok(switcher.includes("styles.referenceText"), "reference descriptions must fit within the row");
});
check("photo actions open, move both directions, and offer direct position entry", () => {
  assert.ok(detail.includes('onAccessibilityTap={onOpen}'));
  assert.ok(detail.includes('accessibilityValue={{ min: 1, max: count, now: count - index }}'));
  for (const action of ["activate", "increment", "decrement", "moveToPosition"]) {
    assert.ok(detail.includes(`name: "${action}"`), `${action} missing`);
  }
  assert.ok(detail.includes("onAccessibilityAction="));
  assert.ok(detail.includes("getPhotoAccessibilityMoveIndex"));
  assert.ok(detail.includes("PhotoPositionSheet"));
  assert.ok(detail.includes("onMoveToPosition="));
});
check("both slider layouts expose values and invoke the same adjustment handler", () => {
  assert.ok(slider.includes('accessibilityRole: "adjustable"'));
  assert.ok(slider.includes('accessibilityValue: { min, max, now: value, text: valueLabel }'));
  assert.ok(slider.includes("onAccessibilityAction:"));
  assert.equal((slider.match(/\.\.\.sliderAccessibilityProps/g) ?? []).length, 2);
  assert.ok(slider.includes("getAccessibleSliderValue"));
  assert.ok(slider.includes("onChange?.(nextValue)"));
  assert.ok(slider.includes("onCommit(nextValue)"));
});
await (async () => {
  try {
    const helpers = await loadPure("features/records/photo-order-accessibility.ts");
    check("photo actions map chronological values to descending display order and stop at bounds", () => {
      assert.equal(helpers.getPhotoAccessibilityMoveIndex(2, 5, "increment"), 1);
      assert.equal(helpers.getPhotoAccessibilityMoveIndex(2, 5, "decrement"), 3);
      assert.equal(helpers.getPhotoAccessibilityMoveIndex(0, 5, "increment"), 0);
      assert.equal(helpers.getPhotoAccessibilityMoveIndex(4, 5, "decrement"), 4);
      assert.equal(helpers.getPhotoPositionIndex("1", 365), 364);
      assert.equal(helpers.getPhotoPositionIndex("365", 365), 0);
      for (const input of ["", "0", "366", "1.5", "3x"]) assert.equal(helpers.getPhotoPositionIndex(input, 365), null);
    });
    const photoAction = findExpression(detail,
      (node) => ts.isJsxAttribute(node) && node.name.getText() === "onAccessibilityAction",
      (node) => node.initializer.expression);
    const photoEvents = [];
    const photoHandler = evaluate(photoAction, {
      disabled: false, index: 2, count: 5,
      getPhotoAccessibilityMoveIndex: helpers.getPhotoAccessibilityMoveIndex,
      onDrop: (...args) => photoEvents.push(["drop", ...args]),
      onOpen: () => photoEvents.push(["open"]),
      onMoveToPosition: () => photoEvents.push(["position"])
    });
    for (const actionName of ["activate", "increment", "decrement", "moveToPosition"]) photoHandler({ nativeEvent: { actionName } });
    check("actual tile handler opens and routes each move through persistence callback", () => {
      assert.deepEqual(photoEvents, [["open"], ["drop", 2, 1], ["drop", 2, 3], ["position"]]);
    });
    const sliders = await loadPure("features/camera/slider-accessibility.ts");
    check("slider actions use ten finite steps, support fractions, and clamp at edges", () => {
      assert.equal(sliders.getAccessibleSliderValue(0.5, 0, 1, "increment"), 0.6);
      assert.equal(sliders.getAccessibleSliderValue(-2, -2, 2, "decrement"), -2);
      assert.equal(sliders.getAccessibleSliderValue(99, 0, 100, "increment"), 100);
      assert.equal(sliders.getAccessibleSliderValue(0, 0, 100, "decrement"), 0);
      assert.equal(sliders.getAccessibleSliderValue(2, 2, 2, "increment"), 2);
    });
    const sliderPropsExpression = findExpression(slider,
      (node, ast) => ts.isVariableDeclaration(node) && node.name.getText(ast) === "sliderAccessibilityProps",
      (node) => node.initializer);
    const sliderEvents = [];
    const sliderProps = evaluate(sliderPropsExpression, {
      min: 0, max: 1, value: 0.5, label: "투명도", valueLabel: "50%",
      getAccessibleSliderValue: sliders.getAccessibleSliderValue,
      onChange: (value) => sliderEvents.push(["change", value]),
      onCommit: (value) => sliderEvents.push(["commit", value])
    });
    sliderProps.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
    check("actual slider action previews and commits the same accessible value", () => {
      assert.deepEqual(sliderEvents, [["change", 0.6], ["commit", 0.6]]);
      assert.equal(sliderProps.accessibilityValue.now, 0.5);
      assert.equal(sliderProps.accessibilityValue.text, "50%");
    });
  } catch (error) { failures.push("accessible adjustment behavior"); console.error(`FAIL - accessible adjustment behavior: ${error.message}`); }
})();
assert.deepEqual(failures, [], "compact/accessibility regressions");
