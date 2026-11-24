import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync('features/camera/CameraScreen.tsx', 'utf8');
const ast = ts.createSourceFile('CameraScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function prop(opening, name) {
  const value = opening.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.text === name)?.initializer;
  return value && ts.isJsxExpression(value) ? value.expression : value;
}
const elements = [];
function visit(node) {
  if (ts.isJsxElement(node)) elements.push(node.openingElement);
  if (ts.isJsxSelfClosingElement(node)) elements.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
const labelled = label => elements.find(e => prop(e, 'accessibilityLabel')?.text === label);

test('zoom and light offer accessible dismiss controls which retain camera settings', () => {
  for (const label of ['확대 설정 닫기', '조명 설정 닫기']) {
    const close = labelled(label);
    assert.ok(close, `${label} must be reachable`);
    assert.equal(prop(close, 'accessibilityRole')?.text, 'button');
    const onPress = prop(close, 'onPress');
    assert.ok(ts.isArrowFunction(onPress));
    // Dismiss must never apply a preset or switch the torch off.
    assert.equal(onPress.body.getText(ast), 'setActiveCameraControlPanel(null)');
  }
});

test('shutter accessibility reports the same disabled policy as the native button', () => {
  const shutter = labelled('사진 촬영');
  const state = prop(shutter, 'accessibilityState');
  const disabled = state.properties.find(p => p.name.getText(ast) === 'disabled').initializer;
  assert.equal(disabled.getText(ast), prop(shutter, 'disabled').getText(ast));
});

test('photo reference opacity uses the high contrast dark slider', () => {
  const slider = elements.find(e => e.tagName.getText(ast) === 'SmoothValueSlider' && prop(e, 'label')?.text === '투명도');
  assert.ok(slider);
  assert.ok(slider.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.text === 'dark' && !p.initializer));
});
