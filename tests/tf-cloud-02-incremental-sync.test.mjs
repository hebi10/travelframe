import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const deps = new Map();
const adapter = {
  getItem: async (key) => deps.get(key) ?? null,
  setItem: async (key, value) => deps.set(key, value)
};
const queueExports = {};
const transpile = (src) => ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
vm.runInNewContext(transpile(read("lib/project-cloud-sync-queue.ts")), {
  exports: queueExports,
  require: (name) => {
    if (name === "@/lib/local-storage") return { localStorageAdapter: adapter };
    throw Error("unexpected dependency " + name);
  }
});

await assert.rejects(() => queueExports.enqueueProjectCloudSync({
  projectId: "", kind: "measurement", itemId: "data"
}), /대기열 대상/);
await assert.rejects(() => queueExports.enqueueProjectCloudSync({
  projectId: "project-1", kind: "measurement"
}), /대기열 대상/);

const f1 = await queueExports.enqueueProjectCloudSync({
  projectId: "project-1", kind: "measurement", itemId: "measurement-1"
});
const f2 = await queueExports.enqueueProjectCloudSync({
  projectId: "project-1", kind: "measurement", itemId: "measurement-1"
});
assert.equal(f1.id, f2.id);
assert.notEqual(f1.revision, f2.revision, "new edits must update the queued revision");
assert.equal((await queueExports.getProjectCloudSyncTasks()).length, 1);
assert.equal(JSON.stringify([...deps.values()]).includes("weightKg"), false,
  "offline retry records must never contain raw health metrics");

await queueExports.enqueueProjectCloudSync({ projectId: "project-2", kind: "settings" });
const initial = await queueExports.getProjectCloudSyncTasks();
assert.equal(initial.length, 2);
const currentTime = Math.max(...initial.map(x => x.nextAttemptAt));
const firstAttempt = await queueExports.processProjectCloudSyncQueue({
  now: currentTime,
  execute: async task => {
    if (task.projectId === "project-1") throw Error("network disconnected");
  }
});
assert.equal(firstAttempt, 1, "a failed project must not stop other eligible projects");
const delayed = (await queueExports.getProjectCloudSyncTasks())[0];
assert.equal(delayed.projectId, "project-1");
assert.equal(delayed.attempts, 1);
assert.equal(delayed.nextAttemptAt, currentTime + 30_000, "first retry delays for thirty seconds");
assert.equal(await queueExports.processProjectCloudSyncQueue({
  now: currentTime + 29_000, execute: async () => {}
}), 0, "do not retry until the backoff deadline");

const done = await queueExports.processProjectCloudSyncQueue({
  now: currentTime + 30_000,
  execute: async () => {}
});
assert.equal(done, 1);
assert.equal((await queueExports.getProjectCloudSyncTasks()).length, 0);

await queueExports.enqueueProjectCloudSync({ projectId: "project-1", kind: "initial" });
let release, started;
const gate = new Promise(resolve => { release = resolve; });
const began = new Promise(resolve => { started = resolve; });
const inFlight = queueExports.processProjectCloudSyncQueue({
  execute: async () => { started(); await gate; }
});
await began;
const newer = await queueExports.enqueueProjectCloudSync({ projectId: "project-1", kind: "initial" });
release();
await inFlight;
const pending = await queueExports.getProjectCloudSyncTasks();
assert.equal(pending.length, 1,
  "a completed in-flight version must never erase an edit queued while it was uploading");
assert.equal(pending[0].revision, newer.revision);
await queueExports.processProjectCloudSyncQueue({ execute: async () => {} });
assert.equal((await queueExports.getProjectCloudSyncTasks()).length, 0);

const source = read("lib/project-cloud-sync.ts");
const app = read("app/_layout.tsx");
const bridge = read("components/project-cloud-sync-bridge.tsx");
const backup = read("lib/cloud-backup.ts");
const slots = read("lib/cloud-backup-project-slots.ts");
const video = read("lib/video-library.ts");
const work = read("lib/work-library.ts");
const camera = read("features/camera/CameraScreen.tsx");
const measurements = read("lib/body-measurement-library.ts");
for (const name of [
  "assertLocalLibraryOwner(user.uid)",
  "getSelectedCloudBackupProjectIds(",
  "projectWantsCloudBackup(",
  "backupPhotoIfEnabled(",
  "backupMadeVideo(",
  "backupImageBundleWork(",
  "backupProjectSupplementIfEnabled(",
  "markInitialSynced(project.id)"
]) assert.ok(source.includes(name), name);
assert.ok(app.includes("<ProjectCloudSyncBridge />"));
assert.ok(bridge.includes('subscriptionStatus !== "verified"'));
assert.ok(bridge.includes('state === "active"'));
assert.ok(bridge.includes("setInterval(flush, 60_000)"));
assert.ok(camera.includes('kind: "photo"'));
assert.ok(slots.includes('kind: "initial"'));
assert.ok(video.includes('kind: "video"'));
assert.ok(work.includes('kind: "image-work"'));
assert.ok(measurements.includes('kind: "measurement"'));
assert.ok(backup.includes('mode?: "all" | "settings" | "measurement"'));
assert.ok(backup.includes('sourceUpdatedAt: video.updatedAt ?? video.createdAt'));
assert.ok(backup.includes('existingVideo.sourceUpdatedAt === (video.updatedAt ?? video.createdAt)'));
console.log("ok - TF-CLOUD-02 retry queue persists IDs only and preserves new revisions without duplicate uploads");
