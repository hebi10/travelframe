import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const files = new Map([
  ["bodyProjects", [
    { id: "a", data: { name: "Training Cloud", updatedAt: "2026-11-17T15:00:00Z" } },
    { id: "remote-only", data: { name: "Restored Goal" } }
  ]],
  ["photoBackups", [
    { id: "photo-a", data: { projectId: "a", imageBackupSize: 3_000_000, backedUpAt: "2026-11-18T03:00:00Z" } },
    { id: "photo-remote", data: { projectId: "remote-only", fileSize: 1_000_000 } }
  ]],
  ["videos", [
    { id: "video-a", data: { projectId: "a", fileSize: 5_000_000, backedUpAt: "2026-11-18T04:00:00Z" } }
  ]],
  ["bodyMeasurements", [
    { id: "measurement-a", data: { projectId: "a" } }
  ]],
  ["bodyProjectSettings", [
    { id: "a", data: { backedUpAt: "2026-11-18T05:00:00Z" } }
  ]]
]);
let active = { uid: "owner" };
let ownerCalls = 0;
let reads = 0;
const user = { uid: "owner" };
const exports = {};
const source = fs.readFileSync("lib/project-cloud-backup-status.ts", "utf8");
const compile = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
vm.runInNewContext(compile, {
  exports,
  require: (name) => {
    const modules = {
      "firebase/firestore": {
        collection: (_firestore, ...segments) => segments.at(-1),
        getDocs: async (type) => {
          reads++;
          return { docs: (files.get(type) ?? []).map((item) => ({
            id: item.id,
            data: () => item.data
          })) };
        }
      },
      "@/lib/body-project-library": {
        getBodyProjects: async () => [
          { id: "a", name: "Current Training" },
          { id: "b", name: "Local Only" }
        ]
      },
      "@/lib/cloud-backup-project-slots": {
        getCloudBackupProjectSlots: async () => [
          { projectId: "a", slotNumber: 1, status: "active" }
        ]
      },
      "@/lib/firebase": {
        firebaseAuth: { get currentUser() { return active; } },
        firestore: {}
      },
      "@/lib/local-library-owner": {
        assertLocalLibraryOwner: async () => { ownerCalls++; }
      },
      "@/lib/photo-library": {
        getPhotos: async () => [
          { id: "photo-a", projectId: "a" },
          { id: "photo-b", projectId: "a" },
          { id: "photo-local", projectId: "b" }
        ]
      },
      "@/lib/project-cloud-sync-queue": {
        getProjectCloudSyncTasks: async () => [
          { id: "settings:a:", projectId: "a" },
          { id: "measurement:a:m1", projectId: "a" }
        ]
      }
    };
    if (!(name in modules)) throw Error("unexpected dependency " + name);
    return modules[name];
  }
});
const statuses = await exports.getProjectCloudBackupStatuses({ user });
const byId = new Map(statuses.map(x => [x.projectId, x]));
assert.equal(statuses.length, 3);
assert.equal(byId.get("a").name, "Current Training");
assert.equal(byId.get("a").slotStatus, "active");
assert.equal(byId.get("a").slotNumber, 1);
assert.equal(byId.get("a").localPhotos, 2);
assert.equal(byId.get("a").cloudPhotos, 1);
assert.equal(byId.get("a").cloudVideos, 1);
assert.equal(byId.get("a").cloudMeasurements, 1);
assert.equal(byId.get("a").cloudBytes, 8_000_000);
assert.equal(byId.get("a").waitingItems, 2);
assert.equal(byId.get("a").lastBackedUpAt, "2026-11-18T05:00:00Z");
assert.equal(byId.get("b").slotStatus, "unselected");
assert.equal(byId.get("b").cloudPhotos, 0);
assert.equal(byId.get("remote-only").cloudPhotos, 1);
assert.equal(byId.get("remote-only").localPhotos, 0);
assert.equal(ownerCalls, 1);
assert.ok(reads >= 5);
const before = reads;
active = { uid: "another" };
const disabled = await exports.getProjectCloudBackupStatuses({ user });
assert.equal(disabled.length, 0);
assert.equal(reads, before, "account change must not fetch another user's data");
const ui = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");
const cards = fs.readFileSync("features/settings/ProjectCloudStatusCards.tsx", "utf8");
assert.ok(ui.includes("getProjectCloudBackupStatuses({ user })"));
assert.ok(ui.includes("retryProjectCloudBackup(projectId)"));
assert.ok(ui.includes("handleProjectRestorePress(projectId)"));
assert.ok(ui.includes("<ProjectCloudStatusCards"));
assert.ok(cards.includes("대기 {item.waitingItems}건"));
assert.ok(cards.includes("확인된 보관 용량"));
assert.ok(cards.includes('accessibilityRole="button"'));
assert.ok(cards.includes("마지막 파일 백업"));
console.log("ok - TF-CLOUD-04 per-project counts/usage/queue timestamps and owner-only UI actions");
