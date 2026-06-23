import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = readFileSync("features/settings/SettingsScreen.tsx", "utf8");
const appSettingsSource = readFileSync("lib/app-settings.ts", "utf8");
const accountSource = readFileSync("features/account/AccountScreen.tsx", "utf8");
const constantsSource = readFileSync("constants/image.ts", "utf8");

for (const snippet of [
  "imageBackupQuality",
  "IMAGE_QUALITY_OPTIONS",
  "이미지 백업 화질",
  "formatImageBackupUsage"
]) {
  assert.ok(settingsSource.includes(snippet), `settings image backup UI missing: ${snippet}`);
}

for (const snippet of [
  "이미지는 백업 시 자동으로 최적화되어 저장됩니다.",
  "화질이 높을수록 이미지가 선명하지만 저장 용량이 커질 수 있습니다."
]) {
  assert.ok(constantsSource.includes(snippet), `image constants missing: ${snippet}`);
}

assert.ok(appSettingsSource.includes("imageBackupQuality"), "app settings should persist image backup quality");
assert.ok(appSettingsSource.includes("DEFAULT_IMAGE_QUALITY"), "app settings should default image backup quality to high");
assert.ok(accountSource.includes("imageBackupBytes"), "account backup summary should show image backup size");

console.log("ok - settings exposes image backup quality and usage");
