import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const user = { uid: "owner" };
const project = { id: "project-a", name: "Training", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z", targetPhotoCount: 100, referenceMode: "first", archived: false };
const photo = { id: "photo-a", projectId: project.id, sequence: 1, uri: "file:///photo.jpg", createdAt: project.createdAt, width: 900, height: 1600, ratioLabel: "9:16", kind: "original", edited: false, addedToVideo: false };

function harness() {
  const auth = { currentUser: user };
  let owner = user.uid;
  const remote = new Map();
  let localPhotos = [photo];
  const deletedProjects = new Set();
  const deletedPhotos = new Set();
  const queued = [];
  let localProjects = [project];
  let localWorks = [];
  const sampleMeasurement = {
    id: "measurement-a", projectId: project.id, photoId: photo.id,
    sequence: 1, recordedAt: photo.createdAt,
    weightKg: 71.2, bodyFatPercent: 17.6, source: "manual"
  };
  let localMeasurements = [sampleMeasurement];
  const sampleMeasurementSettings = {
    enabled: true, promptAfterCapture: true, primaryMetric: "weight",
    fields: { weight: true, bodyFat: true, skeletalMuscle: false, waist: false }
  };
  let localMeasurementSettings = { [project.id]: sampleMeasurementSettings };
  let localPose = { [project.id]: { enabled: true } };
  let localCapture = { [project.id]: { enabled: true, context: null } };
  let uploads = 0;
  let failUploadNumber = 0;
  let releaseFailures = 0;
  let rejectPhotoWrite = false;
  const released = [];
  const settings = { storageMode: "local", cloudBackupEnabled: true, imageBackupQuality: "normal" };
  const snapshot = (key) => ({ id: key.split("/").at(-1), exists: () => remote.has(key), data: () => remote.get(key) });
  const firestoreApi = {
    collection: (_, ...parts) => parts.join("/"), doc: (_, ...parts) => parts.join("/"),
    getDoc: async (key) => snapshot(key),
    getDocs: async (prefix) => {
      const docs = [...remote.keys()].filter(key => key.startsWith(prefix + "/")).map(snapshot);
      return { docs, size: docs.length };
    },
    setDoc: async (key, value, options) => {
      if (rejectPhotoWrite && key.includes("/photoBackups/")) throw new Error("write rejected");
      remote.set(key, options?.merge ? { ...remote.get(key), ...value } : value);
    }, serverTimestamp: () => "SERVER_TIME"
  };
  const modules = {
    "expo-file-system/legacy": { deleteAsync: async () => {} },
    "firebase/firestore": firestoreApi,
    "firebase/functions": { httpsCallable: (_, name) => async (input) => {
      if (name === "reserveBackupUpload") return { data: { backupSessionId: `session-${++uploads}`, storagePath: `users/owner/backups/photos/session-${uploads}.jpg` } };
      if (name === "releaseBackupUpload") {
        if (releaseFailures-- > 0) throw Object.assign(new Error("temporary cleanup failure"), { code: "functions/internal" });
        released.push(input.backupSessionId);
      }
      if (name === "completeImageWorkBackup") remote.set(`users/owner/imageWorks/${input.workId}`, input.imageWork);
      return { data: { released: true } };
    } },
    "firebase/storage": { ref: (_, key) => key, uploadBytes: async () => { if (uploads === failUploadNumber) throw new Error("upload failed"); }, getDownloadURL: async key => `https://storage.test/${key}` },
    "@/lib/firebase": { firebaseAuth: auth, firestore: {}, firebaseStorage: {}, firebaseFunctions: {} },
    "@/lib/local-library-owner": { assertLocalLibraryOwner: async uid => { if (uid !== owner) throw new Error("library owner mismatch"); } },
    "@/lib/private-storage": { privateStorageUrl: path => `https://storage.test/${path}` },
    "@/lib/app-settings": { getAppSettings: async () => settings, isCloudBackupTargetEnabled: () => true },
    "@/constants/image": {},
    "@/lib/cloud-backup-limits": { getCloudBackupStorageLimitBytes: () => 1e9, getCloudBackupVideoLimit: () => 100, canBackupMoreVideos: () => true },
    "@/lib/image-backup-utils": { calculateCombinedImageBackupSize: (a,b) => a+b.reduce((x,y)=>x+y,0), isImageBackupSizeExceeded: () => false, optimizeImageForBackup: async input => ({ ...input, uri: input.uri, size: 100, quality: .8, imageQuality: "normal", originalSize: 100 }) },
    "@/lib/local-storage": { localStorageAdapter: { getItem: async () => "device-a", setItem: async () => {} } },
    "@/lib/plan-entitlements": {
      getPlanTier: () => "pro",
      getPlanEntitlements: () => ({
        maxCloudBackupProjects: 1
      })
    },
    "@/lib/cloud-backup-project-slots": {
      getSelectedCloudBackupProjectIds: async () => new Set([project.id])
    },
    "@/lib/photo-library": {
      getPhotos: async () => localPhotos,
      getDeletedPhotoIds: async () => deletedPhotos,
      wasPhotoDeletedLocally: async (id) => deletedPhotos.has(id),
      markPhotoVersionBackedUp: async (expected) => {
        localPhotos = localPhotos.map((item) => item.id === expected.id && item.updatedAt === expected.updatedAt
          ? { ...item, backupStatus: "backed_up" } : item);
      },
      mergePhotosFromBackup: async (values, restorable) => {
        const added = values.filter((value) => !localPhotos.some((item) => item.id === value.id) &&
          (!deletedPhotos.has(value.id) || restorable.has(value.id)));
        localPhotos = [...localPhotos, ...added];
        return added;
      }
    },
    "@/lib/project-cloud-sync-queue": { getProjectCloudSyncTasks: async () => queued },
    "@/lib/body-project-library": { getBodyProjects: async () => localProjects, getBodyProjectById: async id => localProjects.find(p=>p.id===id), getDeletedBodyProjectIds: async () => new Set(), mergeBodyProjectsFromBackup: async (values, mergeItems, explicit, deletingAtStart) => {
      if (explicit && values.some((value) => deletingAtStart.has(value.id))) throw new Error("pending cloud deletion");
      const restoring = new Set(values.filter((value) => explicit && deletedProjects.has(value.id)).map((value) => value.id));
      const remaining = new Set([...deletedProjects].filter((id) => !restoring.has(id)));
      localProjects = [...localProjects, ...values.filter((value) => !remaining.has(value.id) && !localProjects.some((item) => item.id === value.id))];
      return mergeItems(localProjects, remaining, restoring);
    }, replaceBodyProjects: async values => { localProjects = values; } },
    "@/lib/body-measurement-library": {
      getBodyMeasurements: async id => localMeasurements.filter(item => !id || item.projectId === id),
      getBodyMeasurementSettings: async id => localMeasurementSettings[id] ?? sampleMeasurementSettings,
      mergeBodyMeasurementsFromBackup: async values => {
        const added = values.filter(item => !localMeasurements.some(existing => existing.id === item.id));
        localMeasurements = [...localMeasurements, ...added];
        return added;
      },
      mergeBodyMeasurementSettingsFromBackup: async values => {
        for (const item of values) {
          if (!(item.projectId in localMeasurementSettings)) localMeasurementSettings[item.projectId] = item.settings;
        }
      }
    },
    "@/lib/body-measurement-normalization": {
      getCloudBodyMeasurement: (entry) => load("lib/body-measurement-normalization.ts").getCloudBodyMeasurement(entry),
      normalizeBodyMeasurementEntry: value => value,
      normalizeBodyMeasurementSettings: value => value
    },
    "@/lib/body-pose-alignment": {
      getBodyPoseAlignmentSettings: async id => localPose[id] ?? { enabled: false },
      mergeBodyPoseAlignmentSettingsFromBackup: async values => {
        for (const item of values) {
          if (!(item.projectId in localPose)) localPose[item.projectId] = { enabled: item.enabled };
        }
      }
    },
    "@/lib/body-frame-capture-context": {
      getBodyCaptureContextState: async id => localCapture[id] ?? { enabled: true, context: null },
      mergeBodyCaptureContextStatesFromBackup: async values => {
        for (const item of values) {
          if (!(item.projectId in localCapture)) localCapture[item.projectId] = item.state;
        }
      }
    },
    "@/lib/subscription": { isCreatorSubscriptionActive: () => true },
    "@/lib/storage-mode": { isStorageSaverMode: () => false, shouldUseCloudBackupForStorageMode: () => true },
    "@/lib/video-library": { getMadeVideos: async () => [], getDeletedVideoIds: async () => new Set(), wasVideoDeletedLocally: async () => false, mergeMadeVideosFromBackup: async values => values },
    "@/lib/work-library": { getImageBundleWorks: async () => localWorks, getDeletedImageWorkIds: async () => new Set(), wasImageWorkDeletedLocally: async () => false, mergeImageBundleWorksFromBackup: async values => values }
  };
  function load(file) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require: name => {
      if (name in modules) return modules[name];
      if (name.startsWith("@/")) return load(name.slice(2)+".ts");
      throw new Error(`Unmocked dependency: ${name}`);
    }, fetch: async () => ({ blob: async () => ({ size: 100 }) }), console, setTimeout });
    return exports;
  }
  return {
    api: load("lib/cloud-backup.ts"),
    remote, released, uploads: () => uploads,
    projects: () => localProjects,
    photos: () => localPhotos,
    setPhotos: (values) => { localPhotos = values; },
    deletedProjects, deletedPhotos, queued,
    measurements: () => localMeasurements,
    measurementSettings: () => localMeasurementSettings,
    captureContext: () => localCapture,
    poseSettings: () => localPose,
    changeUser: next => { auth.currentUser = next; },
    setOwner: next => { owner = next; },
    setWorks: values => { localWorks=values; },
    setMeasurements: values => { localMeasurements=values; },
    setProjectSaveMode: mode => { localProjects = localProjects.map(value => ({ ...value, saveMode: mode })); },
    failUpload: n => { failUploadNumber=n; },
    failFirstRelease: () => { releaseFailures=1; },
    emptyLocal: () => {
      localPhotos=[]; localProjects=[]; localMeasurements=[];
      localMeasurementSettings={}; localPose={}; localCapture={};
    },
    rejectWrites: () => { rejectPhotoWrite=true; }
  };
}

// Stale callers and unclaimed/foreign libraries must fail before cloud writes.
{
  const h = harness();
  h.changeUser({ uid: "other" });
  await assert.rejects(h.api.backupPhoto({ user, photo, enabled: true }));
  assert.equal(h.uploads(), 0);
  assert.equal(h.remote.size, 0);
  h.changeUser(user); h.setOwner("other");
  await assert.rejects(h.api.backupCurrentWorkspace({ user, subscription: {} }), /owner mismatch/);
  await assert.rejects(h.api.restoreCloudBackupToLocal({ user }), /owner mismatch/);
}

// Regression: an already backed-up ID must not hide a newer edit.
{
  const h=harness();
  h.remote.set("users/owner/photoBackups/photo-a", { ...photo, localId: photo.id, storagePath: "old-path", backupSessionId: "old-session", backupStatus: "backed_up", sourceUpdatedAt: photo.createdAt });
  await h.api.backupPhoto({ user, photo: { ...photo, updatedAt: "2026-09-19T00:00:00.000Z" }, enabled: true });
  assert.equal(h.uploads(), 1, "new edit must upload even when the ID was backed up");
  assert.equal(h.remote.get("users/owner/photoBackups/photo-a").sourceUpdatedAt, "2026-09-19T00:00:00.000Z");
  assert.ok(h.released.includes("old-session"), "replacement should retire the old upload");
}
// Regression: repeated backup preserves a project's photo, measurement and selected UI settings.
{
  const h=harness();
  await h.api.backupCurrentWorkspace({user, subscription: {}});
  await h.api.backupCurrentWorkspace({user, subscription: {}});
  assert.equal(h.uploads(),1,"unchanged photos must not consume another upload reservation");
  assert.equal(h.remote.get("users/owner/bodyProjects/project-a").name,"Training");
  assert.equal(h.remote.get("users/owner/bodyMeasurements/measurement-a").weightKg,71.2);
  assert.equal(h.remote.get("users/owner/bodyProjectSettings/project-a").measurementSettings.promptAfterCapture,true);
  assert.equal(h.remote.get("users/owner/bodyProjectSettings/project-a").poseAlignmentEnabled,true);
  h.emptyLocal();
  await h.api.restoreCloudBackupToLocal({user});
  assert.equal(h.projects()[0].name,"Training","a fresh device must restore project metadata");
  assert.equal(h.measurements()[0].photoId,"photo-a","measurement must retain original photoId");
  assert.equal(h.measurements()[0].weightKg,71.2,"new device restores body measurements");
  assert.equal(h.measurementSettings()[project.id].promptAfterCapture,true);
  assert.equal(h.poseSettings()[project.id].enabled,true);
  assert.equal(h.captureContext()[project.id].enabled,true);
  await h.api.restoreCloudBackupToLocal({user});
  assert.equal(h.measurements().length,1,"repeat restore must not duplicate measurements");
  h.setMeasurements([{ ...h.measurements()[0], weightKg: 72.9 }]);
  await h.api.restoreCloudBackupToLocal({user});
  assert.equal(h.measurements()[0].weightKg,72.9,"local measurement edits must take precedence");
}
// Regression: switching a project to local-only must not send sensitive measurements.
{
  const h=harness();
  h.setProjectSaveMode("local_only");
  await h.api.backupCurrentWorkspace({user,subscription:{}});
  assert.equal(h.remote.has("users/owner/bodyMeasurements/measurement-a"),false);
  assert.equal(h.remote.has("users/owner/bodyProjectSettings/project-a"),false);
}
// Regression: old backups with project IDs but no project documents must remain reachable.
{
  const h=harness(); h.emptyLocal();
  h.remote.set("users/owner/photoBackups/photo-a", { ...photo, downloadURL: "https://storage.test/photo.jpg" });
  await h.api.restoreCloudBackupToLocal({user});
  assert.equal(h.projects()[0]?.id,"project-a");
}
// Regression: metadata-write failure must release the newly uploaded, unreferenced object.
{
  const h=harness(); h.rejectWrites(); h.failFirstRelease();
  await assert.rejects(h.api.backupPhoto({user,photo,enabled:true}),/write rejected/);
  assert.ok(h.released.includes("session-1"));
}
console.log("ok - project backups restore relationships and replace edited photos safely");

// Regression: partial multi-image failures must retire earlier uploads too.
{
  const h=harness();
  const work={id:"work-a", imageUris:["file:///1.jpg","file:///2.jpg"], createdAt:photo.createdAt};
  h.setWorks([work]); h.failUpload(2);
  await assert.rejects(h.api.backupImageBundleWork({user,work,enabled:true}), /upload failed/);
  assert.ok(h.released.includes("session-1"));
  assert.ok(h.released.includes("session-2"));
}
// Regression: replacing a multi-image backup must retire its previous sessions.
{
  const h=harness();
  const work={id:"work-a", imageUris:["file:///1.jpg"], createdAt:photo.createdAt};
  h.setWorks([work]);
  h.remote.set("users/owner/imageWorks/work-a", {backupSessionIds:["old-work-session"],fileSize:100});
  await h.api.backupImageBundleWork({user,work,enabled:true});
  assert.ok(h.released.includes("old-work-session"));
  assert.equal(h.remote.get("users/owner/imageWorks/work-a").backupSessionIds[0],"session-1");
}

{
  const h = harness();
  await h.api.backupPhoto({ user, photo, enabled: true });
  h.emptyLocal();
  h.deletedProjects.add(project.id);
  h.deletedPhotos.add(photo.id);
  assert.equal((await h.api.restoreCloudBackupToLocal({ user })).photoCount, 0);
  h.queued.push({ projectId: project.id, kind: "delete-project" });
  await assert.rejects(h.api.restoreCloudBackupToLocal({ user, projectIds: [project.id] }), /pending cloud deletion/);
  h.queued.pop();
  assert.equal((await h.api.restoreCloudBackupToLocal({ user, projectIds: [project.id] })).photoCount, 1);
  assert.equal(h.photos()[0].id, photo.id);
}

{
  const h = harness();
  const edited = { ...photo, backupStatus: "pending", updatedAt: "2026-11-21T12:00:00Z" };
  h.setPhotos([edited]);
  await h.api.backupPhoto({ user, photo: edited, enabled: true });
  assert.equal(h.photos()[0].backupStatus, "backed_up");
  const changed = { ...h.photos()[0], sequence: 2, updatedAt: "2026-11-22T12:00:00Z" };
  await h.api.backupProjectPhotoMetadata(user, changed);
  await h.api.backupPhoto({ user, photo: changed, enabled: true });
  assert.equal(h.uploads(), 1, "a metadata update must not upload edited image pixels again");

  const workspaceEdit = { ...changed, backupStatus: "pending", updatedAt: "2026-11-23T12:00:00Z" };
  h.setPhotos([workspaceEdit]);
  await h.api.backupCurrentWorkspace({ user, subscription: {} });
  assert.equal(h.photos()[0].backupStatus, "backed_up");
  assert.equal(h.uploads(), 2, "the workspace backup uploads the new version exactly once");
}

{
  const h = harness();
  h.setMeasurements([{
    id: "edited-health", projectId: project.id, photoId: photo.id,
    source: "health_connect", recordedAt: "2026-10-01T01:00:00Z", sourceAppPackage: "health.app",
    sourceRecordId: "device-record", weightKg: 70, bodyFatPercent: 17, waistCm: 83,
    manualFields: ["waistCm"], manualRecordedAt: "2026-10-02T03:00:00Z"
  }]);
  await h.api.backupCurrentWorkspace({ user, subscription: {} });
  const backedUp = h.remote.get("users/owner/bodyMeasurements/edited-health");
  assert.equal(backedUp.source, "manual");
  assert.equal(backedUp.waistCm, 83);
  assert.equal(backedUp.recordedAt, "2026-10-02T03:00:00Z");
  for (const key of ["weightKg", "bodyFatPercent", "sourceAppPackage", "sourceRecordId", "manualFields"]) {
    assert.equal(Object.hasOwn(backedUp, key), false, key);
  }
}
