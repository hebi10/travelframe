import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const appSettings = read("lib/app-settings.ts");
const camera = read("features/camera/CameraScreen.tsx");
const bodyFrameSettings = read("features/settings/BodyFrameSettingsScreen.tsx");
const guideSteps = read("constants/app-guide-steps.ts");
const records = read("features/records/BodyFrameRecordsScreen.tsx");
const edit = read("app/edit.tsx");
const reminder = read("lib/project-reminder.ts");
const reminderPlugin = read("plugins/with-project-reminder.js");
const projectDetail = read("features/records/BodyFrameProjectDetailScreen.tsx");

assert.ok(
  appSettings.includes("referencePhotoVisible: boolean") &&
    appSettings.includes("referencePhotoVisible: true"),
  "reference photo visibility should be a persisted app setting"
);
assert.ok(
  camera.includes("settings.referencePhotoVisible") &&
    camera.includes("referencePhotoVisible: false") &&
    camera.includes("referencePhotoVisible: true"),
  "camera reference-photo visibility should load and update the shared persisted setting"
);
assert.ok(
  bodyFrameSettings.includes('label="기준 사진 표시"') &&
    bodyFrameSettings.includes('"referencePhotoVisible"'),
  "settings should expose the same persisted reference-photo visibility setting"
);

const keyboardSafeInputFiles = [
  "features/camera/CameraScreen.tsx",
  "features/settings/SettingsScreen.tsx",
  "features/records/BodyMeasurementEditorSheet.tsx",
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/trip-clip/BodyFrameVideoOptionsSheet.tsx",
  "features/account/AccountScreen.tsx",
  "features/trip-clip/TripClipScreen.tsx"
];

for (const file of keyboardSafeInputFiles) {
  const source = read(file);
  if (!source.includes("<TextInput")) continue;
  assert.ok(
    source.includes("KeyboardAvoidingView"),
    `text input surface should avoid the software keyboard: ${file}`
  );
}

assert.ok(
  guideSteps.includes("export const APP_GUIDE_VERSION = 4") &&
    guideSteps.includes('id: "body-frame-project"') &&
    guideSteps.includes('id: "body-frame-reference"') &&
    guideSteps.includes('id: "body-frame-measurements"') &&
    guideSteps.includes('id: "body-frame-video"') &&
    guideSteps.includes('id: "body-frame-settings-backup"'),
  "first-run guide should explain the current end-to-end Body Frame flow"
);
assert.ok(
  bodyFrameSettings.includes('<AppGuideOverlay tabKey="camera" replaySignal={guideReplaySignal}'),
  "settings use-guide action should replay the same full first-run guide"
);

assert.ok(
  records.includes("quickActions") &&
    records.includes("새 프로젝트") &&
    records.includes("바로 촬영"),
  "records header should present project creation and capture as a coherent action group"
);

assert.ok(
  edit.includes("captureEditedImage()") &&
    edit.includes("renderedUri: rendered.uri") &&
    edit.includes("renderedWidth: rendered.width") &&
    edit.includes("renderedHeight: rendered.height") &&
    edit.includes("sourcePhoto?.projectId") &&
    edit.includes('executeSaveEdit("overwrite")'),
  "photo edit save should persist the exact rendered canvas state"
);

assert.ok(
  reminder.includes("message: string") &&
    reminder.includes("notificationMessage") &&
    projectDetail.includes("reminderMessageDraft") &&
    projectDetail.includes('placeholder="오늘 사진을 기록할 시간입니다."'),
  "project reminders should persist a user-editable notification message"
);
assert.ok(
  reminderPlugin.includes("notificationMessage: String") &&
    reminderPlugin.includes("message_$projectId") &&
    reminderPlugin.includes(".setContentText(notificationMessage)"),
  "Android reminder scheduler should persist and show the custom notification message"
);
assert.ok(
  projectDetail.includes("lineHeight:") &&
    projectDetail.includes("reminderSheetTitleWrap"),
  "reminder sheet title should have explicit line height so Korean text is not clipped"
);

console.log("ok - Body Frame UX feedback contract");
