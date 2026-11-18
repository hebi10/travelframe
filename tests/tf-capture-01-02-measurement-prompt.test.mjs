import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = path => fs.readFileSync(path, "utf8");
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const load = (path, dependencies = {}) => {
  const exports = {};
  vm.runInNewContext(transpile(read(path)), {
    exports,
    require: name => {
      if (!Object.hasOwn(dependencies, name)) throw Error("Unexpected import " + name);
      return dependencies[name];
    }
  });
  return exports;
};

const queueModule = load("lib/capture-measurement-prompt.ts");
const changed = [];
let releaseFirst;
const blocked = new Promise(resolve => { releaseFirst = resolve; });
const settings = {
  enabled: true, promptAfterCapture: true, primaryMetric: "weight",
  fields: { weight: true, bodyFat: false, skeletalMuscle: false, waist: false }
};
const events = [
  { id: "photo-1", projectId: "project-a", sequence: 1, createdAt: "2026-11-18T02:00:00Z" },
  { id: "photo-2", projectId: "project-b", sequence: 2, createdAt: "2026-11-18T02:00:01Z" }
];
const prompts = queueModule.createCaptureMeasurementPromptQueue({
  load: async photo => {
    if (photo.id === "photo-1") await blocked;
    return { photo, settings, projectName: photo.projectId, entry: null };
  },
  onChange: next => changed.push(next.map(x => x.photo.id))
});
const one = prompts.enqueue(events[0]);
const duplicate = await prompts.enqueue(events[0]);
const two = prompts.enqueue(events[1]);
assert.equal(duplicate, false, "one photo must open at most one auto prompt");
assert.deepEqual(changed, [], "later shots must not overtake a pending earlier shot");
releaseFirst();
assert.equal(await one, true);
assert.equal(await two, true);
assert.deepEqual(changed, [["photo-1"], ["photo-1", "photo-2"]], "concurrent shots must remain FIFO");
prompts.dismiss("photo-1");
assert.deepEqual(prompts.getItems().map(x => x.photo.id), ["photo-2"]);
prompts.dismiss("photo-2");
assert.equal(prompts.getItems().length, 0);
assert.deepEqual(changed.at(-1), [], "skip or successful save dismisses only its photo");
let rejectLoad = true;
const recovered = queueModule.createCaptureMeasurementPromptQueue({
  load: async photo => { if (rejectLoad) { rejectLoad = false; throw Error("storage read failed"); } return { photo, settings, projectName:"test", entry:null }; },
  onChange: () => {}
});
await assert.rejects(() => recovered.enqueue(events[0]), /storage read failed/);
assert.equal(await recovered.enqueue(events[1]), true, "failed prompt preparation must not block later captures");

const values = new Map();
const types = {
  defaultBodyMeasurementSettings: {
    enabled: false,
    promptAfterCapture: false,
    primaryMetric: "weight",
    fields: { weight: true, bodyFat: false, skeletalMuscle: false, waist: false }
  }
};
const lib = load("lib/body-measurement-library.ts", {
  "@/lib/local-storage": { localStorageAdapter: {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value)
  } },
  "@/lib/body-measurement-normalization": {
    normalizeBodyMeasurementSettings: value => value,
    normalizeBodyMeasurementEntry: value => value
  },
  "@/types/body-measurement": types
});
const oldProject = await lib.getBodyMeasurementSettings("existing");
assert.equal(oldProject.enabled, false, "existing projects retain explicit legacy default");
assert.equal(oldProject.promptAfterCapture, false);
await lib.initializeNewBodyProjectMeasurements("new");
const auto = await lib.getBodyMeasurementSettings("new");
assert.equal(auto.enabled, true);
assert.equal(auto.promptAfterCapture, true);
assert.equal(auto.fields.weight, true);
assert.equal(auto.fields.bodyFat, false, "other metrics stay opt-in");
await lib.updateBodyMeasurementSettings("new", { promptAfterCapture: false });
await lib.initializeNewBodyProjectMeasurements("new");
assert.equal((await lib.getBodyMeasurementSettings("new")).promptAfterCapture, false, "existing opt-out must not be reset");

const record = {
  projectId: "new", photoId: "photo-1", sequence: 1,
  recordedAt: "2026-11-18T02:00:00Z", weightKg: 72.5, source: "manual"
};
const first = await lib.saveBodyMeasurement(record);
const second = await lib.saveBodyMeasurement({ ...record, weightKg: 72.3 });
assert.equal(first.id, second.id, "repeat tap or retry updates existing manual entry instead of duplicating");
assert.equal((await lib.getBodyMeasurements("new")).length, 1);
assert.equal((await lib.getBodyMeasurementByPhotoId("new", "photo-1")).weightKg, 72.3);
await lib.saveBodyMeasurement({ ...record, id: "health-record", source: "health_connect", weightKg: 72.1 });
await lib.saveBodyMeasurement({ ...record, weightKg: 72 });
const afterHealth = await lib.getBodyMeasurements("new");
assert.equal(afterHealth.length, 2, "manual save must not overwrite a Health Connect entry");
assert.equal(afterHealth.find(x => x.id === "health-record").weightKg, 72.1);
assert.equal(afterHealth.find(x => x.id === first.id).weightKg, 72);

const camera = read("features/camera/CameraScreen.tsx");
const wrapper = read("features/camera/BodyFrameCameraScreen.tsx");
const projectList = read("features/records/BodyFrameRecordsScreen.tsx");
const editor = read("features/records/BodyMeasurementEditorSheet.tsx");
assert.ok(camera.includes("onPhotoSaved?: (photo: PhotoItem) => void"));
assert.ok(camera.includes("onPhotoSaved?.(savedPhoto)"));
const saveFlow = camera.slice(camera.indexOf("const runSaveJob = async () =>"), camera.indexOf("const capturePhoto = async () =>"));
assert.ok(saveFlow.indexOf("saveCapturedPhoto(captureInput, captureReservation)") < saveFlow.indexOf("onPhotoSaved?.(savedPhoto)"));
assert.ok(saveFlow.indexOf("onPhotoSaved?.(savedPhoto)") < saveFlow.indexOf("requestPhotoSavePermission()"));
assert.ok(saveFlow.indexOf("onPhotoSaved?.(savedPhoto)") < saveFlow.indexOf("backupPhotoIfEnabled({"));
assert.ok(wrapper.includes("getBodyMeasurementByPhotoId(projectId, photo.id)"), "photo lookup must use stable ID, not sequence");
assert.ok(wrapper.includes("capturePromptQueueRef.current?.enqueue(photo)"));
assert.ok(wrapper.includes("activeCapturePrompt.photo.id"));
assert.ok(wrapper.includes("<BodyMeasurementEditorSheet"));
assert.ok(wrapper.includes("onPhotoSaved={handleCapturedPhotoSaved}"));
for (const source of [wrapper, projectList]) {
  assert.ok(source.includes("initializeNewBodyProjectMeasurements(project.id)"), "new projects enable a configurable prompt");
}
assert.ok(editor.includes("capturePhoto ? \"촬영 기록 입력\""));
assert.ok(editor.includes('cancelLabel={capturePhoto ? "나중에 입력" : "취소"}'));
assert.ok(editor.includes("if (!entry && activeMetrics.every"));
assert.ok(editor.includes("savingRef.current = true"));
assert.ok(editor.includes("setSaveError(error instanceof Error"), "save errors must not discard user input");
assert.ok(editor.includes('accessibilityLabel="방금 저장한 사진"'));

const ast = ts.createSourceFile("sheet.tsx", editor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = [];
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "submit") {
    functions.push(node.initializer.arguments ? node.initializer.getText(ast) : node.initializer.getText(ast));
  }
  ts.forEachChild(node, visit);
};
visit(ast);
assert.equal(functions.length, 1, "run actual measurement submit handler");

const runSubmit = async ({ drafts = { weight: "", bodyFat: "" }, note = "", entry = null, fail = false } = {}) => {
  const saves = [], errors = [], close = [], alerts = [];
  const savingRef = { current: false };
  const context = {
    savingRef, setSaveError: x => errors.push(x), setSaving: () => {},
    activeMetrics: ["weight", "bodyFat"], drafts, note, entry,
    parseDraft: (metric, value) => value.trim() === "" ? undefined : (Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null),
    bodyMeasurementMetricMeta: { weight: { label: "몸무게" }, bodyFat: { label: "체지방률" } },
    Alert: { alert: (...args) => alerts.push(args) }, requestClose: () => close.push("skip"),
    projectId: "new", photoId: "photo-1", sequence: 3, recordedAt: "2026-11-18T02:00:00Z",
    allowRecordedAtEdit: false,
    saveBodyMeasurement: async payload => { if (fail) throw Error("device full"); saves.push(payload); return { id:"measurement-1", ...payload }; },
    onSaved: () => close.push("onSaved"), onClose: () => close.push("onClose")
  };
  const callback = vm.runInNewContext(transpile(`const submit = ${functions[0]}; exports.submit = submit;`), { exports: context, ...context });
  await context.submit();
  return { saves, close, alerts, errors, savingRef };
};
const blank = await runSubmit();
assert.deepEqual(blank.saves, [], "blank fields must not create an empty measurement record");
assert.deepEqual(blank.close, ["skip"]);
const filled = await runSubmit({ drafts: { weight:"74.2", bodyFat:"17.1" }, note:"운동 완료" });
assert.equal(filled.saves.length, 1);
assert.equal(filled.saves[0].projectId, "new");
assert.equal(filled.saves[0].photoId, "photo-1");
assert.equal(filled.saves[0].sequence, 3);
assert.equal(filled.saves[0].weightKg, 74.2);
assert.equal(filled.saves[0].bodyFatPercent, 17.1);
assert.deepEqual(filled.close, ["onSaved", "onClose"]);
const invalid = await runSubmit({ drafts: { weight:"nope", bodyFat:"" } });
assert.equal(invalid.saves.length, 0);
assert.equal(invalid.alerts.length, 1);
const failed = await runSubmit({ drafts: { weight:"74.2", bodyFat:"" }, fail:true });
assert.equal(failed.saves.length, 0);
assert.deepEqual(failed.close, [], "storage failures keep the editor and typed fields open");
assert.match(failed.errors.at(-1), /device full/);
assert.equal(failed.savingRef.current, false);
console.log("ok - TF-CAPTURE-01/02 saved-photo FIFO, optional editor, new-only defaults, idempotent writes and retry safety");
