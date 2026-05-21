import assert from "node:assert/strict";
import fs from "node:fs";

const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const backupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/trip-clip.tsx", "utf8");
const accountSource = fs.readFileSync("app/(tabs)/account.tsx", "utf8");
const userMusicSource = fs.readFileSync("lib/user-music.ts", "utf8");

for (const snippet of [
  'export type CloudBackupTarget = "photos" | "imageBundles" | "videos" | "music";',
  "export const defaultCloudBackupTargets: CloudBackupTargets =",
  "cloudBackupTargets: defaultCloudBackupTargets",
  "normalizeCloudBackupTargets",
  "isCloudBackupTargetEnabled"
]) {
  assert.ok(appSettingsSource.includes(snippet), `app settings backup targets missing: ${snippet}`);
}

for (const snippet of [
  'isCloudBackupTargetEnabled(settings, "photos")',
  'isCloudBackupTargetEnabled(settings, "imageBundles")',
  'isCloudBackupTargetEnabled(settings, "videos")',
  "selectedPhotoBackups",
  "selectedImageBundleBackups",
  "selectedVideoBackups"
]) {
  assert.ok(backupSource.includes(snippet), `workspace backup should honor target setting: ${snippet}`);
}

for (const snippet of [
  "backupTargetOptions",
  "toggleCloudBackupTarget",
  'activeSetting === "cloudBackupTargets"',
  'onPress={() => setActiveSetting("cloudBackupTargets")}',
  "getBackupTargetsSummary(settings.cloudBackupTargets)"
]) {
  assert.ok(settingsSource.includes(snippet), `settings backup target UI missing: ${snippet}`);
}

for (const snippet of [
  "videoBackupTargetEnabled",
  'isCloudBackupTargetEnabled(settings, "videos")',
  "canBackupVideoExport =",
  "shouldBackupVideoExport && videoBackupTargetEnabled"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip video backup target missing: ${snippet}`);
}

for (const [name, source] of [
  ["account", accountSource],
  ["trip clip", tripClipSource]
]) {
  assert.ok(
    source.includes('uploadToCloud: isCloudBackupTargetEnabled(appSettings, "music")'),
    `${name} music upload should honor music backup target`
  );
}

for (const snippet of [
  "uploadToCloud = true",
  'backupStatus: "local_only"',
  "if (!uploadToCloud)",
  "localOnlyTracks"
]) {
  assert.ok(userMusicSource.includes(snippet), `user music local-only backup target missing: ${snippet}`);
}

console.log("ok - cloud backup target selection is wired");
