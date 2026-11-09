import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("features/camera/camera-screen.components.tsx", "utf8");
const ast = ts.createSourceFile("components.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const slider = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "SmoothValueSlider");
assert.ok(slider, "the actual slider component must be exercised");
const compiled = ts.transpileModule(slider.getText(ast), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const accessibility = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("features/camera/slider-accessibility.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText, { exports: accessibility });

function renderSlider(compact = false) {
  const previews = [];
  const commits = [];
  const shared = [];
  const gestures = [];
  function gesture(kind) {
    const state = { kind, config: {}, callbacks: {} };
    const builder = new Proxy(state, {
      get(target, name) {
        if (name in target) return target[name];
        return value => {
          (name.startsWith("on") ? target.callbacks : target.config)[name] = value;
          return builder;
        };
      }
    });
    gestures.push(builder);
    return builder;
  }
  const exports = {};
  const element = (type, props) => ({ type, props });
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert.equal(name, "react/jsx-runtime");
      return { jsx: element, jsxs: element };
    },
    View: "View", Text: "Text", Animated: { View: "AnimatedView" }, GestureDetector: "GestureDetector", styles: {},
    useState: () => [200, () => {}], useEffect: effect => effect(), useMemo: create => create(),
    useSharedValue(value) { const state = { value }; shared.push(state); return state; },
    useDerivedValue: create => ({ get value() { return create(); } }), runOnJS: callback => callback,
    getAccessibleSliderValue: accessibility.getAccessibleSliderValue,
    Gesture: {
      Pan: () => gesture("pan"), Tap: () => gesture("tap"),
      Exclusive: (...children) => ({ kind: "exclusive", children })
    }
  });
  const tree = exports.SmoothValueSlider({
    value: 44, min: 0, max: 100, label: "가이드 크기", compact,
    onChange: value => previews.push(value), onCommit: value => commits.push(value)
  });
  function find(node, type) {
    if (!node || typeof node !== "object") return;
    if (node?.type === type) return node;
    for (const child of [node?.props?.children].flat()) {
      const found = find(child, type);
      if (found) return found;
    }
  }
  const detector = find(tree, "GestureDetector");
  return {
    previews, commits, thumb: shared[0], dragging: shared[2], detector,
    track: detector.props.children, pan: gestures.find(item => item.kind === "pan"), tap: gestures.find(item => item.kind === "tap")
  };
}

for (const compact of [false, true]) {
  test(`vertical scrolling rejected before slider activation preserves values (${compact ? "compact" : "regular"})`, () => {
    const { pan, previews, commits, thumb, dragging } = renderSlider(compact);
    pan.callbacks.onBegin?.({ x: 98, translationX: 0, translationY: 0 });
    pan.callbacks.onFinalize?.({ x: 98, translationX: 0, translationY: -80 }, false);
    assert.deepEqual(previews, []);
    assert.deepEqual(commits, []);
    assert.equal(thumb.value, 88);
    assert.equal(dragging.value, false);
    assert.deepEqual(Array.from(pan.config.activeOffsetX ?? []), [-6, 6]);
    assert.deepEqual(Array.from(pan.config.failOffsetY ?? []), [-10, 10]);
  });
}

test("horizontal activation follows the finger without adding activation distance twice", () => {
  const { pan, previews, commits, thumb, dragging } = renderSlider();
  pan.callbacks.onBegin?.({ x: 120, translationX: 0 });
  pan.callbacks.onStart?.({ x: 128, translationX: 8 });
  pan.callbacks.onUpdate({ x: 140, translationX: 20 });
  assert.equal(thumb.value, 140);
  assert.equal(dragging.value, true);
  pan.callbacks.onFinalize({}, true);
  assert.deepEqual(previews, [64, 70]);
  assert.deepEqual(commits, [70]);
  assert.equal(dragging.value, false);
});

test("cancellation after a recognized horizontal drag commits the displayed preview once", () => {
  const { pan, previews, commits, dragging } = renderSlider();
  pan.callbacks.onStart?.({ x: 128, translationX: 8 });
  pan.callbacks.onUpdate({ x: 140, translationX: 20 });
  pan.callbacks.onFinalize({}, false);
  assert.deepEqual(previews, [64, 70]);
  assert.deepEqual(commits, [70]);
  assert.equal(dragging.value, false);
});

test("a successful bounded tap previews and commits once after the pan fails", () => {
  const { pan, tap, previews, commits, detector } = renderSlider();
  assert.ok(tap, "tapping the track must still adjust the slider");
  assert.equal(detector.props.gesture.kind, "exclusive");
  assert.equal(detector.props.gesture.children[0], pan);
  assert.equal(detector.props.gesture.children[1], tap);
  assert.equal(tap.config.maxDeltaX, 10);
  assert.equal(tap.config.maxDeltaY, 10);
  pan.callbacks.onFinalize({}, false);
  tap.callbacks.onEnd({ x: 150 }, true);
  assert.deepEqual(previews, [75]);
  assert.deepEqual(commits, [75]);
});

test("simple taps preserve the expanded touch area used by horizontal drags", () => {
  const { pan, tap } = renderSlider();
  assert.deepEqual({ ...tap.config.hitSlop }, { top: 10, bottom: 10, left: 10, right: 10 });
  assert.deepEqual({ ...tap.config.hitSlop }, { ...pan.config.hitSlop });
});

test("failed taps do not preview or save and accessibility adjustments remain available", () => {
  const { tap, track, previews, commits } = renderSlider(true);
  assert.ok(tap);
  tap.callbacks.onEnd({ x: 150 }, false);
  assert.deepEqual(previews, []);
  assert.deepEqual(commits, []);
  assert.equal(track.props.accessibilityRole, "adjustable");
  assert.equal(track.props.accessibilityLabel, "가이드 크기");
  assert.equal(track.props.accessibilityValue.now, 44);
  track.props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
  assert.deepEqual(previews, [54]);
  assert.deepEqual(commits, [54]);
});
