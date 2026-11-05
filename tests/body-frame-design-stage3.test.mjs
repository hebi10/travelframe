import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const home = read("features/trip-clip/BodyFrameVideoHomeScreen.tsx");
const creator = read("features/trip-clip/BodyFrameVideoScreen.tsx");
const library = read("features/trip-clip/BodyFrameVideoLibraryScreen.tsx");
const detail = read("app/video/[id].tsx");
const settings = read("features/settings/BodyFrameSettingsScreen.tsx");
const account = read("features/account/AccountScreen.tsx");
const accountStyles = read("features/account/account-screen.styles.ts");
const theme = read("constants/app-theme.ts");

for (const [name, source] of [
  ["video home", home],
  ["video creator", creator],
  ["video library", library],
  ["video detail", detail],
  ["settings", settings]
]) {
  assert.ok(source.includes("getBodyFrameControlColors(palette)"), name + " should use semantic CTA tokens");
  assert.equal(source.includes("bodyFrameAccent"), false, name + " should not use success green as default CTA");
  assert.ok(source.includes("bodyFrameDesign"), name + " should consume existing spacing/tap tokens");
}
assert.ok(theme.includes("getBodyFrameControlColors"));

for (const snippet of [
  "getBodyProjectPhotos(photos, project.id)",
  "project.coverPhotoId",
  "styles.projectCoverImage",
  "styles.videoPlayIndicator",
  "contentFit=\"contain\"",
  "styles.heroCard",
  'router.push("/video-library")',
  'router.push("/video-create")'
]) {
  assert.ok(home.includes(snippet), "video home visual hierarchy contract: " + snippet);
}
for (const snippet of [
  "styles.previewHeader",
  "styles.settingsTitle",
  "styles.summaryValueGroup",
  'name="chevron-right"',
  "accessibilityState={onPress ? { disabled } : undefined}",
  "styles.exportFooter,",
  "styles.exportFeedback,",
  'onPress={() => void createVideo()}',
  "getBodyFrameVideoPreviewTransform(previewWidth, frameAspectRatio, RECORDING_VIEW_WIDTH)"
]) {
  assert.ok(creator.includes(snippet), "video creator/renderer boundary contract: " + snippet);
}
for (const label of ["사진 수", "사진 간격", "영상 길이", "화질", "화면 비율", "텍스트"]) {
  assert.ok(creator.includes('label="' + label + '"'), "video option must survive Stage 3: " + label);
}
assert.ok(creator.includes("TripClipRecordingCanvas") && creator.includes("saveMadeVideo("));

for (const snippet of [
  "styles.videoPlayIndicator",
  "accessibilityState={{ disabled: deletingId === video.id }}",
  "deleteMadeVideo(video.id)",
  "confirmDelete(video)",
  "styles.cardButton",
  "contentFit=\"contain\""
]) {
  assert.ok(library.includes(snippet), "video library contract: " + snippet);
}
for (const snippet of [
  "bodyFrameTypography.pageTitle",
  "getExpoVideoModule",
  "styles.videoStartButton",
  'name="play"',
  'pathname: "/legacy-video-edit"',
  "showLoginRequiredForVideoCreation",
  "VideoPlayerFrame source={videoSource as string}"
]) {
  assert.ok(detail.includes(snippet), "video detail playback/edit contract: " + snippet);
}

for (const group of [
  "촬영", "저장 및 백업", "변화 영상", "화면", "계정 및 플랜", "정보 및 개인정보"
]) {
  assert.ok(settings.includes('SectionBlock title="' + group + '"'), "keep settings group: " + group);
}
for (const snippet of [
  "styles.settingRowValue",
  'name="chevron-right"',
  "accessibilityState={{ selected: active, disabled }}",
  "saveAppSettings(",
  'setActiveSetting("fontStyle")',
  'setActiveSetting("fontSize")',
  'router.push("/advanced-settings")'
]) {
  assert.ok(settings.includes(snippet), "settings state/compatibility contract: " + snippet);
}

for (const snippet of [
  "primaryFill: {", "primaryContrastText: {",
  "minHeight: bodyFrameDesign.primaryButtonHeight",
  "borderRadius: bodyFrameDesign.cardRadius",
  "paymentOpenButton: {",
  "minHeight: bodyFrameDesign.minTouchSize",
  "activeFill: {"
]) {
  assert.ok(accountStyles.includes(snippet), "account styles contract: " + snippet);
}
for (const snippet of [
  "themed.primaryFill",
  "themed.primaryContrastText",
  "accessibilityState={{ selected: isActive }}",
  "runAuthAction(logOut",
  "useGooglePlayBilling",
  "purchaseProduct(",
  "restorePurchases()",
  "confirmCloudRestore",
  "CloudBackupProjectSlotsSection",
  'SectionBlock title="현재 상태"',
  'SectionBlock title="클라우드 백업"',
  'SectionBlock title="플랜 및 결제"'
]) {
  assert.ok(account.includes(snippet), "account functionality contract: " + snippet);
}
const slotIndex = account.indexOf("<CloudBackupProjectSlotsSection");
const backupIndex = account.indexOf('SectionBlock title="클라우드 백업"');
const planIndex = account.indexOf('SectionBlock title="플랜 및 결제"');
assert.ok(backupIndex < slotIndex && slotIndex < planIndex, "backup slots should stay grouped with backup before purchases");
assert.equal((account.match(/<CloudBackupProjectSlotsSection/g) ?? []).length, 1);
assert.ok(account.includes("styles.secondaryButton, themed.secondaryButton, isSubmitting && styles.disabledButton"), "logout should not look like purchase CTA");
assert.ok(account.includes("getStorePrice") && account.includes("handlePaymentPurchase"));
assert.ok(account.includes("GOOGLE_PLAY_SUBSCRIPTIONS_URL"));

console.log("ok - Body Frame Stage 3 video, settings and account design contracts");
