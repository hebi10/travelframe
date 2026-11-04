import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { exports, setTimeout, clearTimeout, AbortController, Error });
  return exports;
}
const model = load('lib/body-frame-video.ts');
assert.equal(typeof model.getBodyFrameVideoMeasurement, 'function', 'immutable-ID selector must exist');
const measurements = [
  { photoId: 'B', sequence: 2, weightKg: 80 },
  { sequence: 2, weightKg: 90 },
  { photoId: 'A', sequence: 1, weightKg: 70 }
];
const before = JSON.stringify(measurements);
assert.equal(model.getBodyFrameVideoMeasurement({ id: 'C', sequence: 2 }, measurements), null,
  'unmeasured C moved to deleted B sequence must not inherit 80kg or legacy sequence values');
assert.equal(model.getBodyFrameVideoMeasurement({ id: 'A', sequence: 8 }, measurements), measurements[2]);
assert.equal(JSON.stringify(measurements), before, 'measurement history stays untouched');

const { createBodyFrameImageReadiness, prepareBodyFrameVideoPhotos, withBodyFrameExportTimeout } = load('lib/body-frame-video-export.ts');
const readiness = createBodyFrameImageReadiness(15);
let settled = false;
const waiting = readiness.wait('run:A').then(() => { settled = true; });
await Promise.resolve();
assert.equal(settled, false, 'export waits for actual image display');
readiness.displayed('old:A');
await Promise.resolve();
assert.equal(settled, false, 'stale callbacks do not ready the current image');
readiness.displayed('run:A');
await waiting;
await readiness.wait('run:A'); // Repeated video frames can reuse this displayed image.
const failed = readiness.wait('run:B');
readiness.failed('run:B');
await assert.rejects(failed, /사진.*불러오/);
await assert.rejects(readiness.wait('run:C'), /시간.*사진/);
const cancel = new AbortController();
const cancelled = readiness.wait('run:D', cancel.signal);
cancel.abort();
await assert.rejects(cancelled, /취소/);
await assert.rejects(withBodyFrameExportTimeout(new Promise(() => {}), undefined, 5), /시간/);

let active = 0;
let maxActive = 0;
const sources = [];
const photos = [{ id: 'A', uri: 'file://missing', downloadURL: 'https://original/A', previewUri: 'file://thumb' }, { id: 'C', uri: 'file://original/C', previewUri: 'file://thumbC' }];
const staged = await prepareBodyFrameVideoPhotos(photos, async (uri, id) => {
  active++; maxActive = Math.max(maxActive, active); sources.push(uri);
  await Promise.resolve(); active--;
  if (uri === 'file://missing') throw new Error('missing');
  return `file://staged/${id}`;
});
assert.equal(maxActive, 1, 'original staging is bounded, not a bulk memory prefetch');
assert.deepEqual(sources, ['file://missing', 'https://original/A', 'file://original/C']);
assert.equal(staged[0].uri, 'file://staged/A');
assert.equal(staged[0].previewUri, staged[0].uri, 'export never substitutes a thumbnail');
assert.equal(photos[0].uri, 'file://missing', 'staging never mutates library metadata');
await assert.rejects(prepareBodyFrameVideoPhotos(photos, async () => { throw Error('missing'); }), /원본.*확인/);
const stagingCancel = new AbortController();
let attempts = 0;
await assert.rejects(prepareBodyFrameVideoPhotos(photos, async () => {
  attempts++; stagingCancel.abort(); return 'file://staged';
}, stagingCancel.signal), /취소/);
assert.equal(attempts, 1, 'cancel stops subsequent source/staging work');
console.log('ok - immutable measurement identity, bounded original staging, actual display/error/timeout/cancel handshake');

// Exercise the rendered image event contract, rather than only checking source tokens.
const canvasExports = {};
const jsx = (type, props, key) => ({ type, props, key });
const modules = {
  'react/jsx-runtime': { jsx, jsxs: jsx },
  '@/components/private-media-image': { Image: 'Image' },
  'react-native': { StyleSheet: { create: value => value, absoluteFillObject: {} }, Text: 'Text', View: 'View' },
  '@/components/camera-guide-overlay': { CameraGuideOverlay: 'Guide' },
  '@/constants/app-theme': { colors: { ink: '#000', inverse: '#fff' } },
  '@/lib/trip-clip-photo-adjustment': { getTripClipPhotoAdjustment: () => ({ translateX: 0, translateY: 0, scale: 1 }) }
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/trip-clip-recording-canvas.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText, { exports: canvasExports, require: name => { assert.ok(modules[name], name); return modules[name]; } });
const events = [];
const tree = canvasExports.TripClipRecordingCanvas({
  frame: { currentPhoto: { id: 'A', uri: 'file://original', previewUri: 'file://staged/A', width: 3, height: 4 }, nextPhoto: null, transitionProgress: 0 },
  template: 'minimal', transition: 'none', frameAspectRatio: 0.75, photoAdjustments: {},
  currentImageKey: 'run:A', onCurrentImageDisplay: key => events.push(['display', key]),
  onCurrentImageError: key => events.push(['error', key]), showWatermark: true,
  bodyFrameOverlayText: '80kg', bodyFrameOverlayPosition: 'bottom-right'
});
const elements = [];
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(walk);
  elements.push(node); walk(node.props?.children);
}
walk(tree);
const image = elements.find(node => node.type === 'Image');
assert.equal(image.props.source.uri, 'file://staged/A');
assert.equal(image.key, 'run:A');
assert.equal(events.length, 0, 'rendering an image alone is not proof that it loaded');
image.props.onDisplay(); image.props.onError();
assert.deepEqual(events, [['display', 'run:A'], ['error', 'run:A']]);
assert.ok(elements.some(node => node.props?.children === '바디 프레임'), 'shared canvas includes the plan watermark');
const overlay = elements.find(node => node.props?.children === '80kg');
assert.equal(overlay.props.style.at(-1).bottom, 58, 'overlay avoids bottom-right watermark in the shared canvas');
console.log('ok - recording canvas reports actual native image display/error for the current run and renders watermark-safe overlays');
