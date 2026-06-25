import assert from "node:assert/strict";
import fs from "node:fs";

const settingsSource = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");

assert.ok(
  settingsSource.includes("option.requiresBackupPlan && !canSelectCloudSaveTarget"),
  "storage mode cloud backup option should be disabled before Pro"
);
assert.ok(
  settingsSource.includes('targetStorageMode !== "local_only" && !canSelectCloudSaveTarget'),
  "enabling cloud backup storage mode should be blocked before Pro"
);
assert.ok(
  settingsSource.includes('onPress={planEntitlements.canBackupToCloud ? handleRestoreBackupPress : undefined}'),
  "cloud restore entry should not open for non-Pro accounts"
);
assert.ok(
  settingsSource.includes("disabled={isBackupSubmitting || !planEntitlements.canBackupToCloud}"),
  "cloud restore buttons should be visibly disabled before Pro"
);
assert.ok(
  settingsSource.includes('onPress={planEntitlements.canBackupToCloud ? () => setActiveSetting("cloudBackupTargets") : undefined}'),
  "cloud backup target settings should not open for non-Pro accounts"
);
assert.equal(
  settingsSource.includes('await updateSetting({\n            storageMode: "local_backup"'),
  false,
  "non-Pro backup enable flow must not persist cloud backup settings"
);

console.log("ok - settings gates cloud backup before Pro");
