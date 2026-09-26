import assert from "node:assert/strict";
import fs from "node:fs";

const accountSource = fs.readFileSync(
  "features/account/AccountScreen.tsx",
  "utf8"
);
const accountStatsSource = fs.readFileSync(
  "features/account/hooks/useAccountStats.ts",
  "utf8"
);
const accountConstantsSource = fs.readFileSync(
  "features/account/account-screen.constants.ts",
  "utf8"
);
const guideStepsSource = fs.readFileSync(
  "constants/app-guide-steps.ts",
  "utf8"
);
const guideHookSource = fs.readFileSync(
  "hooks/use-app-guide.ts",
  "utf8"
);
const guideOverlaySource = fs.readFileSync(
  "components/app-guide-overlay.tsx",
  "utf8"
);
const settingsSource = fs.readFileSync(
  "features/settings/BodyFrameSettingsScreen.tsx",
  "utf8"
);
const cameraShellSource = fs.readFileSync(
  "features/camera/BodyFrameCameraScreen.tsx",
  "utf8"
);

for (const token of [
  'SectionBlock title="현재 상태"',
  'label="현재 플랜"',
  'label="현재 프로젝트"',
  'label="현재 기록"',
  'SectionBlock title="클라우드 백업"',
  'SectionBlock title="플랜 및 결제"',
  "구매 복원",
  "로그아웃"
]) {
  assert.ok(
    accountSource.includes(token),
    `Body Frame account should contain ${token}`
  );
}

for (const legacy of [
  "영상 출력 (주간 한도)",
  "이미지 보관함",
  "영상 보관함",
  "음악 보관함",
  "내 음악 관리",
  "여러 사진 작업"
]) {
  assert.equal(
    accountSource.includes(legacy),
    false,
    `Body Frame account should not expose legacy account copy: ${legacy}`
  );
}

for (const legacyLoader of [
  "syncUserMusicTracks",
  "getWeeklyVideoExportUsage",
  "getImageBundleWorks",
  "getMadeVideos",
  "setMusicTracks"
]) {
  assert.equal(
    accountStatsSource.includes(legacyLoader),
    false,
    `Body Frame account loader should not load legacy data: ${legacyLoader}`
  );
}

assert.equal(
  accountConstantsSource.includes("음악"),
  false,
  "Body Frame plan copy should not advertise legacy music storage"
);

assert.ok(
  guideStepsSource.includes("APP_GUIDE_VERSION = 4") &&
    guideStepsSource.includes('id: "body-frame-welcome"') &&
    guideStepsSource.includes('id: "body-frame-project"') &&
    guideStepsSource.includes('id: "body-frame-reference"') &&
    guideStepsSource.includes('id: "body-frame-measurements"') &&
    guideStepsSource.includes('id: "body-frame-video"') &&
    guideStepsSource.includes('id: "body-frame-settings-backup"') &&
    guideStepsSource.includes("바디 프레임에 오신 것을 환영합니다."),
  "first-run guide should explain the complete current Body Frame flow"
);
assert.ok(
  guideHookSource.includes('tabKey !== "camera"'),
  "automatic first-run guide should only open on camera"
);
assert.equal(
  guideHookSource.includes("isLoggedIn") || guideHookSource.includes("useAuth"),
  false,
  "first-run welcome should not depend on authentication state"
);
assert.ok(
  guideOverlaySource.includes("isWelcome") &&
    guideOverlaySource.includes("시작하기"),
  "welcome guide should render a dedicated single CTA"
);

assert.ok(
  settingsSource.includes("guideReplaySignal") &&
    settingsSource.includes("setGuideReplaySignal") &&
    settingsSource.includes("replaySignal={guideReplaySignal}"),
  "settings should replay the guide without opening legacy settings"
);

assert.ok(
  cameraShellSource.includes("첫 사진을 찍어 기준을 만들어주세요.") &&
    cameraShellSource.includes("번째 사진을 저장했습니다."),
  "camera should retain contextual first-record guidance"
);

assert.ok(
  fs.existsSync("app/advanced-settings.tsx") &&
    fs.existsSync("app/legacy-studio.tsx"),
  "legacy routes should remain available for compatibility"
);

console.log("Body Frame UI Stage 6 account/onboarding contract passed.");
