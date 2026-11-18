import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const source = fs.readFileSync("lib/project-restore-selection.ts", "utf8");
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText, { exports });
const select = exports.selectCloudProjectRestoreItems;

const projects = [
  { id: "p-a", name: "A" },
  { id: "p-b", name: "B" }
];
const photos = [
  { id: "photo-1", projectId: "p-a" },
  { id: "photo-2", projectId: "p-a" },
  { id: "photo-3", projectId: "p-b" },
  { id: "orphan" }
];
const imageWorks = [
  { id: "work-a", photoIds: ["photo-1", "photo-2"] },
  { id: "work-b", photoIds: ["photo-3"] },
  { id: "work-mixed", photoIds: ["photo-1", "photo-3"] },
  { id: "work-unlinked", photoIds: [] }
];
const videos = [
  { id: "video-a", projectId: "p-a", photoIds: ["photo-1"] },
  { id: "video-b", projectId: "p-b", photoIds: ["photo-3"] },
  { id: "video-linked-a", photoIds: ["photo-1", "photo-2"] },
  { id: "video-mixed", photoIds: ["photo-1", "photo-3"] },
  { id: "video-unlinked", photoIds: [] }
];
const measurements = [
  { id: "measurement-a", projectId: "p-a", photoId: "photo-1" },
  { id: "measurement-b", projectId: "p-b", photoId: "photo-3" }
];
const settings = [
  { projectId: "p-a", value: "private a" },
  { projectId: "p-b", value: "private b" }
];
const all = { projects, photos, imageWorks, videos, measurements, settings };
const ids = x => JSON.parse(JSON.stringify(x.map(i => i.id ?? i.projectId)));
const chosen = select({ ...all, requestedProjectIds: ["p-a"] });
assert.deepEqual(ids(chosen.projects), ["p-a"]);
assert.deepEqual(ids(chosen.photos), ["photo-1", "photo-2"]);
assert.deepEqual(ids(chosen.imageWorks), ["work-a"]);
assert.deepEqual(ids(chosen.videos), ["video-a", "video-linked-a"]);
assert.deepEqual(ids(chosen.measurements), ["measurement-a"]);
assert.deepEqual(ids(chosen.settings), ["p-a"]);
const chosenB = select({ ...all, requestedProjectIds: ["p-b"] });
assert.deepEqual(ids(chosenB.photos), ["photo-3"]);
assert.deepEqual(ids(chosenB.imageWorks), ["work-b"]);
assert.deepEqual(ids(chosenB.videos), ["video-b"]);
assert.deepEqual(ids(chosenB.measurements), ["measurement-b"]);

assert.throws(() => select({ ...all, requestedProjectIds: [] }), /프로젝트/);
assert.throws(() => select({ ...all, requestedProjectIds: ["p-other"] }), /프로젝트/);
assert.throws(() => select({ ...all, requestedProjectIds: ["p-a", "p-other"] }), /프로젝트/);
const oldFlow = select(all);
for (const key of ["projects", "photos", "imageWorks", "videos", "measurements", "settings"]) {
  assert.equal(oldFlow[key].length, all[key].length, "full legacy restore must remain unchanged: " + key);
}
const combined = select({ ...all, requestedProjectIds: ["p-a", "p-b"] });
assert.deepEqual(ids(combined.imageWorks), ["work-a", "work-b", "work-mixed"]);
assert.deepEqual(ids(combined.videos), ["video-a", "video-b", "video-linked-a", "video-mixed"]);

const cloud = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const ui = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");
assert.ok(cloud.includes("export const getRestorableCloudProjects = async"));
assert.ok(cloud.includes("requestedProjectIds: projectIds"));
assert.ok(cloud.includes("selectCloudProjectRestoreItems({"));
assert.ok(cloud.includes("mergeBodyMeasurementSettingsFromBackup"));
assert.ok(cloud.includes("mergeBodyMeasurementsFromBackup"));
assert.ok(cloud.includes("await assertLocalLibraryOwner(user.uid)"));
assert.ok(ui.includes("getRestorableCloudProjects({ user })"));
assert.ok(ui.includes("projectIds: [project.id]"));
assert.ok(ui.includes("프로젝트 선택 복원"));
assert.ok(ui.includes("selectedRestoreProjectId === project.id"));
assert.ok(ui.includes("다른 프로젝트와 현재 기기에 있는 기록은 변경하지 않습니다."));
console.log("ok - TF-CLOUD-03 project selective restoration preserves legacy full restore and isolates sensitive records");
