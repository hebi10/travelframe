import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const backend = read("functions/index.js");
const ui = read("features/account/CloudBackupProjectSlotsSection.tsx");
const settings = read("features/settings/SettingsScreen.tsx");
const slots = read("lib/cloud-backup-project-slots.ts");
const cloud = read("lib/cloud-backup.ts");
const projectLibrary = read("lib/body-project-library.ts");
const projectTypes = read("types/body-project.ts");
const nativeQaWorkflow = read(".github/workflows/body-frame-device-qa.yml");

const replace = backend.slice(
  backend.indexOf("exports.replaceCloudBackupProject = secureOnCall("),
  backend.indexOf("const getKstWeekStart =")
);
assert.ok(replace.includes("confirmDeletePreviousProjectId"));
assert.ok(replace.includes("previousProjectId !== projectId"));
assert.ok(replace.indexOf("confirmDeletePreviousProjectId") <
          replace.indexOf("deleteBackupProjectCloudData({"),
  "server must demand previous project confirmation before cloud data is destroyed");
assert.ok(replace.includes('operation: "owner"'));
assert.ok(replace.includes("tx.delete(lockRef)"), "replacement retains lock and crash-retry protocol");
assert.ok(slots.includes("confirmDeletePreviousProjectId: string"));
assert.ok(slots.includes("{ slotId, projectId, confirmDeletePreviousProjectId }"));
assert.ok(ui.includes("confirmDeletePreviousProjectId: slot.projectId"));
assert.ok(ui.includes('saveMode: "local_only"'), "non-destructive stop must change only future sync");
assert.ok(ui.includes('cloudResumeMode: project.saveMode === "cloud" ? "cloud" : "local_cloud"'), "stop must preserve the prior cloud-only save mode");
assert.ok(ui.includes('project.cloudResumeMode === "cloud" ? "cloud" : "local_cloud"'), "resume must restore the previous device save behavior");
assert.ok(ui.includes('cloudResumeMode: null'), "resume clears the temporary pause marker");
assert.ok(ui.includes('kind: "initial"'), "resume must resync changes made while the project was paused");
assert.ok(projectLibrary.includes('record.cloudResumeMode === "cloud"'), "restart must restore the pause marker from persistent storage");
assert.ok(projectLibrary.includes('{ cloudResumeMode: undefined }'), "resume must clear persisted pause state");
assert.ok(projectTypes.includes('cloudResumeMode?: "cloud" | "local_cloud"'));
assert.ok(nativeQaWorkflow.includes("  push:\n    branches:\n      - main"), "native QA must target final main");
assert.ok(nativeQaWorkflow.includes("contains(github.event.head_commit.message, '[android-qa]')"), "native QA must require an explicit final merge marker");
assert.ok(!nativeQaWorkflow.includes("  pull_request:\n"), "native QA must not re-run on intermediate PR updates");
assert.ok(ui.includes("기존 원격 파일은 삭제되지 않습니다"));
assert.ok(ui.includes("측정 기록과 촬영 설정이 영구 삭제됩니다"));
assert.ok(ui.includes("원본이 없으면 복구할 수 없습니다"));
const lastDeletion = backend.slice(
  backend.indexOf("exports.deleteCloudBackupData = secureOnCall("),
  backend.indexOf("exports.deleteAdminCloudBackupData = secureOnCall(")
);
assert.ok(lastDeletion.includes('request.data?.confirmation !== "DELETE_ALL_CLOUD_BACKUPS"'));
assert.ok(lastDeletion.indexOf("DELETE_ALL_CLOUD_BACKUPS") <
          lastDeletion.indexOf("deleteCloudBackupDataForUser(uid)"));
assert.ok(cloud.includes('confirmation: "DELETE_ALL_CLOUD_BACKUPS"'));
assert.ok(settings.includes("모든 클라우드 백업 영구 삭제"));
assert.ok(settings.includes("영구 삭제 실행"));
assert.ok(settings.includes("몸무게·체지방률 등 측정 기록"));
const projectRules = read("lib/project-save-policy.ts");
assert.ok(projectRules.includes('project?.saveMode ? isProjectCloudSaveMode(project.saveMode)'));
const serverRemove = backend.slice(
  backend.indexOf("const deleteBackupProjectCloudData = async ("),
  backend.indexOf("const assertNoReservedProjectUploads")
);
assert.ok(serverRemove.includes('collection("bodyMeasurements")'));
assert.ok(serverRemove.includes('collection("bodyProjectSettings")'));
assert.ok(serverRemove.includes("deleteOwnedCloudBackupStoragePath"));
console.log("ok - TF-CLOUD-05 cloud stop preserves remote, slot replace and all-data deletion require explicit confirmation");
