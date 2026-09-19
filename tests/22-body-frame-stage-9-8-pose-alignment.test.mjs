import assert from "node:assert/strict";
import fs from "node:fs";

const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
const poseTypes = fs.readFileSync("types/body-pose-alignment.ts", "utf8");
const poseLibrary = fs.readFileSync("lib/body-pose-alignment.ts", "utf8");
const poseBridge = fs.readFileSync("lib/android-pose-alignment.ts", "utf8");
const posePlugin = fs.readFileSync("plugins/with-body-pose-alignment.js", "utf8");
const cameraSession = fs.readFileSync("lib/body-frame-camera-session.ts", "utf8");
const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const bodyCameraSource = fs.readFileSync(
  "features/camera/BodyFrameCameraScreen.tsx",
  "utf8"
);
const projectDetailSource = fs.readFileSync(
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "utf8"
);
const cameraStyles = fs.readFileSync(
  "features/camera/camera-screen.styles.ts",
  "utf8"
);
const photoTypes = fs.readFileSync("types/photo.ts", "utf8");
const cloudBackup = fs.readFileSync("lib/cloud-backup.ts", "utf8");
const privacy = fs.readFileSync("privacy/privacy-policy.md", "utf8");
const releaseVerify = fs.readFileSync("scripts/verify-release-readiness.mjs", "utf8");
const manualQa = fs.readFileSync("docs/manual-device-qa.md", "utf8");

assert.ok(
  app.expo.plugins.includes("./plugins/with-body-pose-alignment"),
  "app config should run the pose alignment plugin"
);

for (const token of [
  'com.google.mlkit:pose-detection:18.0.0-beta5',
  "PoseDetectorOptions.STREAM_MODE",
  "AndroidPoseAlignmentPackage",
  "AndroidPoseAlignmentModule",
  "PoseLandmark.LEFT_SHOULDER",
  "PoseLandmark.RIGHT_SHOULDER",
  "PoseLandmark.LEFT_HIP",
  "PoseLandmark.RIGHT_HIP",
  "PoseLandmark.LEFT_ANKLE",
  "PoseLandmark.RIGHT_ANKLE"
]) {
  assert.ok(posePlugin.includes(token), `pose plugin missing: ${token}`);
}

for (const forbidden of ["OkHttp", "Firebase", "upload", "http://", "https://"]) {
  assert.equal(
    posePlugin.includes(forbidden),
    false,
    `native pose module should not contain network/upload code: ${forbidden}`
  );
}

assert.ok(
  poseTypes.includes("enabled: false"),
  "project pose alignment should default OFF"
);
assert.ok(
  poseLibrary.includes("BODY_POSE_ANALYSIS_INTERVAL_MS = 1200"),
  "pose analysis should be deliberately throttled"
);
for (const token of [
  '"move_left"',
  '"move_right"',
  '"move_closer"',
  '"move_farther"',
  '"level_shoulders"',
  '"aligned"',
  "왼쪽으로 조금 이동하세요.",
  "오른쪽으로 조금 이동하세요.",
  "카메라에 조금 더 가까이 와주세요.",
  "카메라에서 조금 더 멀어져 주세요.",
  "어깨 높이를 기준 사진과 맞춰주세요.",
  "위치가 맞았습니다."
]) {
  assert.ok(poseLibrary.includes(token), `pose guidance missing: ${token}`);
}

assert.ok(
  poseBridge.includes('Platform.OS === "android"') &&
    poseBridge.includes("NativeModules.AndroidPoseAlignment") &&
    poseBridge.includes("return null"),
  "pose bridge should be Android-only with safe unsupported fallback"
);

assert.ok(
  cameraSession.includes("poseAlignmentEnabled: boolean") &&
    cameraSession.includes("poseAlignmentEnabled: false"),
  "camera session should carry an explicit pose-assist flag"
);

assert.ok(
  bodyCameraSource.includes("getBodyPoseAlignmentSettings") &&
    bodyCameraSource.includes("poseAlignmentEnabled") &&
    bodyCameraSource.includes("setBodyFrameCameraSession"),
  "active project pose settings should reach the camera session"
);

for (const token of [
  "cameraRef.current?.takeSnapshot()",
  'saveToTemporaryFileAsync("jpg", 70)',
  "BODY_POSE_ANALYSIS_INTERVAL_MS",
  "analyzeAndroidPose(referenceUri)",
  "analyzeAndroidPose(snapshotPath)",
  "getBodyPoseGuidance",
  "Haptics.NotificationFeedbackType.Success",
  "deleteLocalFile(uri)",
  "poseAlignmentBanner",
  "poseGuidance.message"
]) {
  assert.ok(cameraSource.includes(token), `camera pose flow missing: ${token}`);
}

assert.equal(
  cameraSource.includes("frameProcessor"),
  false,
  "Stage 9-8 should not add a continuous frame processor"
);
assert.equal(
  cameraSource.includes("PoseLandmark"),
  false,
  "Camera UI should receive only normalized pose guidance, not native landmarks"
);

for (const token of [
  "자세 맞춤 도움",
  "기기에서만 분석",
  "서버로 전송하지 않습니다.",
  "실험 기능",
  "getBodyPoseAlignmentSettings",
  "updateBodyPoseAlignmentSettings"
]) {
  assert.ok(
    projectDetailSource.includes(token),
    `project pose setting missing: ${token}`
  );
}

assert.ok(
  cameraStyles.includes("poseAlignmentBanner") &&
    cameraStyles.includes("fontSize: bodyFrameTypography.caption"),
  "pose guidance should remain a compact Body Frame banner"
);

for (const forbidden of [
  "pose",
  "landmark",
  "shoulder",
  "bodyPose"
]) {
  assert.equal(
    new RegExp(forbidden, "i").test(photoTypes),
    false,
    `PhotoItem should not store pose data: ${forbidden}`
  );
  assert.equal(
    new RegExp(forbidden, "i").test(cloudBackup),
    false,
    `cloud photo backup should not include pose data: ${forbidden}`
  );
}

for (const token of [
  "자세 맞춤 도움",
  "기기 내",
  "서버로 업로드하지 않습니다.",
  "임시 이미지",
  "Google ML Kit"
]) {
  assert.ok(privacy.includes(token), `privacy disclosure missing: ${token}`);
  assert.ok(releaseVerify.includes(token) || token === "Google ML Kit", `release verifier missing pose privacy token: ${token}`);
}

for (const token of [
  "기본 OFF",
  "왼쪽/오른쪽 이동",
  "위치가 맞았습니다.",
  "분석용 프리뷰 스냅샷"
]) {
  assert.ok(manualQa.includes(token), `manual pose QA missing: ${token}`);
}

const generatedModule =
  "android/app/src/main/java/com/haebi/photoguide/pose/AndroidPoseAlignmentModule.kt";
assert.ok(
  fs.existsSync(generatedModule),
  "clean prebuild should generate AndroidPoseAlignmentModule.kt"
);
const generatedSource = fs.readFileSync(generatedModule, "utf8");
assert.ok(
  generatedSource.includes("PoseDetection.getClient") &&
    generatedSource.includes("PoseDetectorOptions.STREAM_MODE") &&
    generatedSource.includes('getName(): String = "AndroidPoseAlignment"'),
  "generated native pose module should use ML Kit STREAM_MODE"
);

console.log("Body Frame Stage 9-8 pose alignment contract passed.");
