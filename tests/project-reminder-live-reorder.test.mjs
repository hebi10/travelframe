import assert from "node:assert/strict";
import fs from "node:fs";

const appConfig = JSON.parse(fs.readFileSync("app.json", "utf8"));
const plugin = fs.readFileSync("plugins/with-project-reminder.js", "utf8");
const reminder = fs.readFileSync("lib/project-reminder.ts", "utf8");
const projectDetail = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);

assert.ok(
  appConfig.expo.plugins.includes("./plugins/with-project-reminder"),
  "project reminder plugin should run during Expo prebuild"
);

for (const token of [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "AndroidProjectReminderPackage",
  "AndroidProjectReminderModule",
  "ProjectReminderReceiver",
  "alarmManager.setAndAllowWhileIdle",
  "NotificationChannel",
  "Intent.ACTION_BOOT_COMPLETED",
  "Intent.ACTION_MY_PACKAGE_REPLACED",
  'setContentText("오늘의 사진을 기록할 시간입니다.")'
]) {
  assert.ok(plugin.includes(token), `project reminder native plugin missing: ${token}`);
}

for (const token of [
  "getProjectReminderSettings",
  "updateProjectReminderSettings",
  "cancelProjectReminder",
  "PermissionsAndroid.request",
  "formatProjectReminderTime",
  "parseProjectReminderTime",
  '"body-frame.project-reminders.v1"'
]) {
  assert.ok(reminder.includes(token), `project reminder API missing: ${token}`);
}

for (const token of [
  "촬영 알림",
  "원하는 시간에 매일 촬영 알림을 받을 수 있습니다.",
  "reminderModalOpen",
  "reminderTimeDraft",
  "saveReminderSettings",
  "cancelProjectReminder(project.id)"
]) {
  assert.ok(projectDetail.includes(token), `project reminder UI missing: ${token}`);
}

for (const token of [
  "dragSourceIndex",
  "dragTargetIndex",
  "shiftedIndex = index - 1",
  "shiftedIndex = index + 1",
  "withTiming(siblingTranslateX",
  "withTiming(siblingTranslateY",
  "setPhotoDragSourceIndex(sourceIndex)"
]) {
  assert.ok(projectDetail.includes(token), `live reorder preview missing: ${token}`);
}

console.log("ok - project reminders and live drag displacement are wired");
