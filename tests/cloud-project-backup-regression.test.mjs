import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const user = { uid: "owner" };
const project = { id: "project-a", name: "Training", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z", targetPhotoCount: 100, referenceMode: "first", archived: false };
const photo = { id: "photo-a", projectId: project.id, sequence: 1, uri: "file:///photo.jpg", createdAt: project.createdAt, width: 900, height: 1600, ratioLabel: "9:16", kind: "original", edited: false, addedToVideo: false };

function harness() {
  const remote = new Map();
  let localPhotos = [photo];
  let localProjects = [project];
  let localWorks = [];
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
    "@/lib/firebase": { firestore: {}, firebaseStorage: {}, firebaseFunctions: {} },
    "@/lib/app-settings": { getAppSettings: async () => settings, isCloudBackupTargetEnabled: () => true },
    "@/constants/image": {},
    "@/lib/cloud-backup-limits": { getCloudBackupStorageLimitBytes: () => 1e9, getCloudBackupVideoLimit: () => 100, canBackupMoreVideos: () => true },
    "@/lib/image-backup-utils": { calculateCombinedImageBackupSize: (a,b) => a+b.reduce((x,y)=>x+y,0), isImageBackupSizeExceeded: () => false, optimizeImageForBackup: async input => ({ ...input, uri: input.uri, size: 100, quality: .8, imageQuality: "normal", originalSize: 100 }) },
    "@/lib/local-storage": { localStorageAdapter: { getItem: async () => "device-a", setItem: async () => {} } },
    "@/lib/plan-entitlements": { getPlanTier: () => "pro" },
    "@/lib/photo-library": { getPhotos: async () => localPhotos, getDeletedPhotoIds: async () => new Set(), wasPhotoDeletedLocally: async () => false, replacePhotosFromBackup: async values => { localPhotos = values; } },
    "@/lib/body-project-library": { getBodyProjects: async () => localProjects, getBodyProjectById: async id => localProjects.find(p=>p.id===id), mergeBodyProjectsFromBackup: async values => { localProjects = [...localProjects, ...values.filter(p=>!localProjects.some(x=>x.id===p.id))]; }, replaceBodyProjects: async values => { localProjects = values; } },
    "@/lib/subscription": { isCreatorSubscriptionActive: () => true },
    "@/lib/storage-mode": { isStorageSaverMode: () => false, shouldUseCloudBackupForStorageMode: () => true },
    "@/lib/video-library": { getMadeVideos: async () => [], getDeletedVideoIds: async () => new Set(), wasVideoDeletedLocally: async () => false, replaceMadeVideosFromBackup: async () => {} },
    "@/lib/work-library": { getImageBundleWorks: async () => localWorks, getDeletedImageWorkIds: async () => new Set(), wasImageWorkDeletedLocally: async () => false, replaceImageBundleWorksFromBackup: async () => {} }
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
  return { api: load("lib/cloud-backup.ts"), remote, released, uploads: () => uploads, projects: () => localProjects,
    setWorks: values => { localWorks=values; }, failUpload: n => { failUploadNumber=n; },
    failFirstRelease: () => { releaseFailures=1; },
    emptyLocal: () => { localPhotos=[]; localProjects=[]; }, rejectWrites: () => { rejectPhotoWrite=true; } };
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
// Regression: repeat full backup should reuse the unchanged upload and include its project.
{
  const h=harness();
  await h.api.backupCurrentWorkspace({user, subscription: {}});
  await h.api.backupCurrentWorkspace({user, subscription: {}});
  assert.equal(h.uploads(),1,"unchanged photos must not consume another upload reservation");
  assert.equal(h.remote.get("users/owner/bodyProjects/project-a").name,"Training");
  h.emptyLocal();
  await h.api.restoreCloudBackupToLocal({user});
  assert.equal(h.projects()[0].name,"Training","a fresh device must restore project metadata");
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
