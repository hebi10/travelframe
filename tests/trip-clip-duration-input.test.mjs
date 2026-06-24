import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const source = [
  readTripClipSource(),
  readFileSync("features/trip-clip/trip-clip-screen.components.tsx", "utf8"),
  readFileSync("features/trip-clip/trip-clip-screen.helpers.ts", "utf8")
].join("\n");
const stylesSource = readFileSync(
  "features/trip-clip/trip-clip-screen.styles.ts",
  "utf8"
);

assert.ok(
  source.includes("const [editingDurationId, setEditingDurationId] = useState<string | null>(null);"),
  "timeline should track the duration row being edited"
);

for (const snippet of [
  "Keyboard.addListener(\"keyboardDidShow\"",
  "Keyboard.addListener(\"keyboardDidHide\"",
  "ANDROID_DURATION_KEYBOARD_FALLBACK_HEIGHT",
  "ANDROID_DURATION_KEYBOARD_EXTRA_GAP",
  "ANDROID_DURATION_KEYBOARD_RECHECK_DELAYS",
  "durationKeyboardPanelBottom",
  "timelineDurationKeyboardPanel",
  "timelineDurationKeyboardInput",
  "timelineDurationEditing.editingDurationId ? (",
  "value={timelineDurationEditing.durationInputValue}",
  "keyboardType=\"decimal-pad\"",
  "onBlur={timelineDurationEditing.finishActiveDurationEditing}",
  "onSubmitEditing={timelineDurationEditing.finishActiveDurationEditing}"
]) {
  assert.ok(source.includes(snippet), `timeline duration keyboard-safe input missing: ${snippet}`);
}

assert.ok(
  source.includes("normalizedInput.length > 0 && Number.isFinite(parsedDuration)"),
  "empty duration input should not be saved as zero"
);

assert.ok(
  source.includes("durationKeyboardHeight > 0") &&
    source.includes("Platform.OS === \"android\""),
  "timeline duration input should use an Android fallback before keyboard height is measured"
);

assert.ok(
  source.includes(
    "Math.max(durationKeyboardHeight, ANDROID_DURATION_KEYBOARD_FALLBACK_HEIGHT)"
  ),
  "timeline duration input should not trust an undersized Android keyboard height"
);

assert.ok(
  source.includes("ANDROID_DURATION_KEYBOARD_EXTRA_GAP") &&
    source.includes("DURATION_KEYBOARD_PANEL_GAP +\n      ANDROID_DURATION_KEYBOARD_EXTRA_GAP"),
  "timeline duration input should keep an Android-only gap above the numeric keyboard"
);

assert.ok(
  source.includes("const ANDROID_DURATION_KEYBOARD_RECHECK_DELAYS = [80, 180, 320] as const;"),
  "timeline duration input should recheck keyboard metrics three times after Android keyboard show"
);

for (const snippet of [
  "durationKeyboardRecheckTimersRef",
  "clearDurationKeyboardHeightRechecks",
  "scheduleDurationKeyboardHeightRechecks",
  "Keyboard.metrics()",
  "ANDROID_DURATION_KEYBOARD_RECHECK_DELAYS.map",
  "setTimeout(updateDurationKeyboardHeightFromMetrics, delay)",
  "setDurationKeyboardHeight((current) => Math.max(current, metricsHeight))",
  "clearTimeout(timer)"
]) {
  assert.ok(source.includes(snippet), `timeline duration limited keyboard recheck missing: ${snippet}`);
}

for (const snippet of [
  "import { Feather } from \"@expo/vector-icons\";",
  "alignSelf: \"flex-start\"",
  "paddingRight: 8",
  "style={{ marginTop: 1 }}",
  "Feather",
  "name=\"edit-2\""
]) {
  assert.ok(source.includes(snippet), `timeline duration edit icon missing: ${snippet}`);
}

assert.match(
  source,
  /<Pressable[\s\S]*?onPress=\{onBeginEditing\}[\s\S]*?\{duration\.toFixed\(1\)\}초/,
  "timeline duration text should be clickable and show seconds in Korean"
);

assert.ok(
  source.includes("timelineDurationEditing.changeDuration(photo.id, index, -0.5)") &&
    source.includes("timelineDurationEditing.changeDuration(photo.id, index, 0.5)"),
  "timeline should keep 0.5 second step buttons"
);

for (const snippet of [
  "timelineDurationInput",
  "timelineDurationDetailEditing",
  "timelineDurationKeyboardPanel",
  "timelineDurationKeyboardInput",
  "timelineDurationKeyboardDoneButton"
]) {
  assert.ok(stylesSource.includes(snippet), `timeline duration keyboard style missing: ${snippet}`);
}

console.log("ok - trip clip timeline duration supports numeric input");
