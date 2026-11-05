import assert from "node:assert/strict";
import fs from "node:fs";

const screen = fs.readFileSync("features/trip-clip/BodyFrameVideoScreen.tsx", "utf8");
const captureQa = fs.readFileSync("scripts/capture-android-qa.py", "utf8");

const scrollEnd = screen.indexOf("      </ScrollView>");
const footer = screen.indexOf("styles.exportFooter,", scrollEnd);
const feedback = screen.indexOf("styles.exportFeedback,", footer);
const exportClick = screen.indexOf("onPress={() => void createVideo()}", footer);

assert.ok(scrollEnd >= 0 && scrollEnd < footer, "video footer should stay outside scrolling options");
assert.ok(footer < feedback && feedback < exportClick, "video export results should be readable above the fixed create button");
assert.ok(screen.includes('accessibilityLiveRegion="polite"'), "save/failure status must be announced accessibly");
assert.ok(screen.includes("setMessage(appSaved ?"), "local-only export result must stay visible after album failure");
assert.ok(screen.includes("Body Frame 앨범에 저장했습니다."), "real album completion should provide feedback");
assert.ok(captureQa.includes("search='below'"), "QA must scroll to notification card moved below photos");
assert.ok(captureQa.includes("any('앨범에 저장했습니다.' in value for value in strings)"),
  "QA must verify album completion before accepting an idle export button");
assert.ok(captureQa.includes("result['captureSkippedReason']"),
  "QA must preserve the original error after intentional force-stop");

console.log("ok - Body Frame video export feedback is visible and real QA terminal states are verified");
