import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const transpile = path => ts.transpileModule(fs.readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const policy = { };
vm.runInNewContext(transpile("lib/project-save-policy.ts"), { exports: policy });

for (const [mode, device, cloud] of [
  ["cloud", false, true],
  ["local_cloud", true, true],
  ["local_only", true, false]
]) {
  const actual = policy.getProjectSaveTargets({ projectMode: mode });
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), { app: true, device, cloud });
  assert.equal(policy.isProjectSaveMode(mode), true);
}
assert.equal(policy.isProjectSaveMode("invalid"), false);
assert.equal(policy.getProjectSaveTargets({ projectMode: "cloud", cloudAllowed: false }).cloud, false);
assert.equal(policy.getProjectSaveTargets({ projectMode: "local_cloud", cloudAllowed: false }).device, true);
assert.equal(policy.projectWantsCloudBackup({ saveMode: "local_only" }, true), false);
assert.equal(policy.projectWantsCloudBackup({ saveMode: "cloud" }, false), true);
assert.equal(policy.projectWantsCloudBackup({}, true), true);
assert.equal(policy.projectWantsCloudBackup({}, false), false);

for (const [legacyScope, device, cloud] of [
  ["app", false, false],
  ["device", true, false],
  ["cloud", false, true],
  ["app_device", true, false],
  ["app_cloud", false, true],
  ["device_cloud", true, true],
  ["all", true, true]
]) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(policy.getProjectSaveTargets({ legacyScope }))),
    { app: true, device, cloud },
    "legacy preferences must be preserved except for mandatory app saving: " + legacyScope
  );
}

const linkedPhoto = [
  { id: "photo-a", projectId: "project-a" },
  { id: "photo-b", projectId: "project-b" }
];
const projects = [
  { id: "project-a", saveMode: "local_only" },
  { id: "project-b", saveMode: "cloud" }
];
for (const [photoIds, selectedIds, enabled, expected] of [
  [["photo-a"], ["project-a"], true, false],
  [["photo-b"], ["project-b"], true, true],
  [["photo-b"], [], true, false],
  [["photo-a", "photo-b"], ["project-a", "project-b"], true, false],
  [[], [], true, true],
  [[], [], false, false]
]) {
  assert.equal(policy.canUploadLinkedProjectWork({
    photoIds,
    photos: linkedPhoto,
    projects,
    selectedProjectIds: new Set(selectedIds),
    legacyEnabled: enabled
  }), expected, "photo-linked work must not bypass project privacy or selected slot constraints");
}

assert.equal(
  policy.canUploadLinkedProjectWork({
    photoIds: undefined,
    photos: linkedPhoto,
    projects,
    selectedProjectIds: new Set(["project-b"]),
    legacyEnabled: true
  }),
  true,
  "older image works without photoIds must preserve legacy backup behavior rather than crash"
);

const memory = new Map();
const old = [
  { id: "project-a", name: "기존 A", createdAt: "2026-01-01", updatedAt: "2026-01-01", targetPhotoCount: 100, referenceMode: "first", archived: false },
  { id: "project-b", name: "기존 B", createdAt: "2026-01-02", updatedAt: "2026-01-02", targetPhotoCount: 100, referenceMode: "latest", archived: false }
];
memory.set("body-frame.projects.v1", JSON.stringify(old));
const lib = {};
vm.runInNewContext(transpile("lib/body-project-library.ts"), {
  exports: lib,
  require: id => {
    if (id === "@/lib/body-frame-normalization") return { normalizeReferencePhotoMode: x => x === "first" ? "first" : "latest" };
    if (id === "@/lib/body-frame-stage2-utils") return { sanitizeProjectPathSegment: x => x };
    if (id === "@/lib/local-storage") return { localStorageAdapter: {
      getItem: async k => memory.get(k) ?? null,
      setItem: async (k,v) => { memory.set(k,v); }
    } };
    if (id === "@/lib/project-save-policy") return policy;
    throw new Error("unexpected dependency: " + id);
  }
});

const loaded = await lib.getBodyProjects();
assert.equal(loaded.length, 2);
assert.equal(loaded.find(x => x.id === "project-a").saveMode, undefined);
assert.equal(loaded.find(x => x.id === "project-b").saveMode, undefined);
assert.equal(JSON.parse(memory.get("body-frame.projects.v1"))[0].saveMode, undefined,
  "reading legacy records must not migrate or rewrite their storage");
const newProject = await lib.createBodyProject({ name: "새 목표" });
assert.equal(newProject.saveMode, "local_only", "new projects should use local album with mandatory app copy");
await lib.updateBodyProject("project-a", { saveMode: "cloud" });
const current = await lib.getBodyProjects();
assert.equal(current.find(x => x.id === "project-a").saveMode, "cloud");
assert.equal(current.find(x => x.id === "project-b").saveMode, undefined,
  "one project's storage change must not mutate another's legacy preference");
await lib.updateBodyProject("project-a", { saveMode: "invalid" });
assert.equal((await lib.getBodyProjectById("project-a")).saveMode, "cloud");
const afterReload = await lib.getBodyProjects();
assert.equal(afterReload.find(x => x.id === newProject.id).saveMode, "local_only");

const globalSettings = fs.readFileSync("lib/app-settings.ts", "utf8");
assert.ok(globalSettings.includes("...cameraSaveScopeTargets[scope],\n  app: true"),
  "old device/cloud-only scopes must still force an app-library copy");
assert.ok(globalSettings.includes("targets = { ...targets, app: true };"));
const camera = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const wrap = fs.readFileSync("features/camera/BodyFrameCameraScreen.tsx", "utf8");
const detail = fs.readFileSync("features/records/BodyFrameProjectDetailScreen.tsx", "utf8");
assert.ok(camera.includes("getBodyProjectById(captureProjectId)"));
assert.ok(camera.includes("getProjectSaveTargets({"));
assert.ok(camera.includes("if (target === \"app\") return;"));
const saveJob = camera.slice(camera.indexOf("const runSaveJob = async () =>"), camera.indexOf("const capturePhoto = async () =>"));
assert.ok(saveJob.indexOf("saveCapturedPhoto(captureInput, captureReservation)") <
  saveJob.indexOf("await requestPhotoSavePermission()"),
  "an album permission dialog must not block durable app saving");
assert.ok(saveJob.indexOf("saveCapturedPhoto(captureInput, captureReservation)") <
  saveJob.indexOf("backupPhotoIfEnabled({"),
  "cloud should start only after the app photo has been saved");
assert.ok(wrap.includes("getSelectedCloudBackupProjectIds("));
assert.ok(wrap.includes('updateBodyProject(projectId, { saveMode: mode })'));
assert.ok(detail.includes("PROJECT_SAVE_MODE_OPTIONS.map"));
assert.ok(detail.includes("...(saveModeDraft ? { saveMode: saveModeDraft } : {})"));
assert.ok(detail.includes("getSelectedCloudBackupProjectIds("));
const backup = fs.readFileSync("lib/cloud-backup.ts", "utf8");
assert.ok(backup.includes("projectWantsCloudBackup"));
assert.ok(backup.includes("currentProject?.saveMode === \"local_only\""));
assert.ok(backup.includes("const cloudProjectIds = new Set("));
assert.ok(backup.includes("getBodyProjectById(video.projectId)"));
assert.ok(backup.includes('itemType: "video"'));
assert.ok(backup.includes("canUploadLinkedProjectWork("));

console.log("ok - TF-CLOUD-08 project save modes enforce mandatory app storage, legacy migration, and cloud opt-out");
