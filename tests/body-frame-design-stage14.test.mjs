import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

const records = read("features/records/BodyFrameRecordsScreen.tsx");
const project = read("features/records/BodyFrameProjectDetailScreen.tsx");
const metrics = read("features/records/BodyMeasurementHistoryScreen.tsx");
const videoHome = read("features/trip-clip/BodyFrameVideoHomeScreen.tsx");
const videoCreate = read("features/trip-clip/BodyFrameVideoScreen.tsx");
const settings = read("features/settings/BodyFrameSettingsScreen.tsx");
const switcher = read("features/camera/BodyFrameProjectSwitcher.tsx");
const workflow = read(".github/workflows/body-frame-device-qa.yml");

assert.match(records, /header:\s*\{\s*marginBottom:\s*8/);
assert.match(records, /projectsHeading:\s*\{[^}]*marginBottom:\s*6/);
assert.match(records, /projectCopy:\s*\{[^}]*padding:\s*10/);
assert.ok(records.includes("contentWidth >= 560 ? 2 : 1"));
assert.ok(records.includes("width: projectCardWidth"));
assert.ok(records.includes("getProjectCover(project, photos)"));

assert.match(project, /projectTabs:\s*\{[^}]*marginBottom:\s*8/);
assert.match(project, /comparePreviewCard:\s*\{[^}]*maxWidth:\s*560/);
assert.match(project, /comparePreviewItem:\s*\{[^}]*height:\s*156/);
assert.ok(project.includes('useState<"records" | "metrics" | "stats">("records")'));
assert.ok(project.includes('contentFit="contain"'));
assert.ok(project.includes("styles.photoGrid"));

assert.match(metrics, /metricSelector:\s*\{[^}]*paddingBottom:\s*8/);
assert.match(metrics, /periodSelector:\s*\{[^}]*marginBottom:\s*8/);
assert.ok(metrics.includes("BodyMeasurementSummaryCard"));
assert.ok(metrics.includes("setSelectedPeriod(option.value)"));
assert.ok(metrics.includes("setSelectedMetric(metric)"));

assert.match(videoHome, /content:\s*\{[^}]*gap:\s*12/);
assert.match(videoHome, /heroIllustrationFrame:\s*\{[^}]*height:\s*80/);
assert.match(videoHome, /projectRow:\s*\{[^}]*minHeight:\s*80/);
assert.ok(videoHome.includes("startVideo(project)"));
assert.ok(videoHome.includes("styles.heroIllustration"));
assert.ok(videoHome.includes("router.push(\"/video-library\")"));

assert.ok(videoCreate.includes("windowWidth * 0.82"));
assert.ok(videoCreate.includes("windowHeight * 0.30 * frameAspectRatio"));
assert.ok(videoCreate.includes('maxWidth: 360'));
assert.ok(videoCreate.includes("TripClipRecordingCanvas"));
assert.ok(videoCreate.includes("saveMadeVideo("));

assert.match(settings, /settingRow:\s*\{[^}]*minHeight:\s*52/);
assert.match(settings, /settingRow:\s*\{[^}]*paddingVertical:\s*6/);
assert.ok(settings.includes("accessibilityHint={onPress ? detail : undefined}"));
assert.ok(settings.includes("numberOfLines={1}"));
assert.ok(settings.includes("saveAppSettings("));
assert.ok(settings.includes("setActiveSetting(\"fontStyle\")"));

assert.match(switcher, /referenceChoice:\s*\{[^}]*minHeight:\s*56/);
assert.match(switcher, /label:\s*\{[^}]*marginTop:\s*10/);
assert.ok(switcher.includes("onCreateProject"));
assert.ok(switcher.includes("bodyFrameDesign.primaryButtonHeight") && switcher.includes("minHeight: 56"));

for(const str of ["feat/body-frame-design-stage14-", "stage13-design-captures", "phone-360dp", "tablet-750dp"]){
  assert.ok(workflow.includes(str), str);
}
for(const code of [records, project, metrics, videoHome, videoCreate, settings, switcher]){
  assert.doesNotMatch(code, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
}
console.log("Stage 14 density, image bounds, action/data preservation: PASS");
